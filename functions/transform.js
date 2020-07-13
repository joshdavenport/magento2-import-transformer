const Papa = require('papaparse');

const parseCsv = (csv) => {
  const papaBlessed = Papa.parse(csv, {
    header: true
  });

  if(!papaBlessed || !papaBlessed.data) {
    throw new Error('Data wasn\'t parseable');
  }

  return papaBlessed.data;
}

const findAdditionalAttributeHeaders = (headers) => {
  let passedAdditionalAttributeHeader = false;

  return headers.filter(key => {
    if (passedAdditionalAttributeHeader) {
      return true;
    }
    
    if (key === 'additional_attributes') {
      passedAdditionalAttributeHeader = true;
    }

    return false;
  });
}

const extractColumns = (data, columns) => {
  if (!columns) {
    return {};
  }

  if(!Array.isArray(columns)) {
    columns = [columns];
  }

  const result = {};

  Object.keys(data).forEach(key => {
    if(columns.indexOf(key) !== -1) {
      result[key] = data[key];
    }
  });

  return result;
}

const purgeColumns = (data, columns) => {
  if (!columns) {
    return data;
  }

  if (!Array.isArray(columns)) {
    columns = [columns];
  }

  const result = data;

  Object.keys(data).forEach(key => {
    if (columns.indexOf(key) !== -1) {
      delete result[key];
    }
  });

  return result;
}

const convertColumnsToStringKeyValue = (data, multiValueSeperator) => {
  return Object.keys(data)
    .map(key => `${key}=${data[key]}`)
    .join(multiValueSeperator);
}

const parseConfigurableAttributes = (configurableAttributes) => {
  const matches = configurableAttributes.split(',').map(attr => attr.match(/(?<attributeCode>[^\(\W]*)\W?\((?<label>[^\)]*)\)/).groups);

  if (matches) {
    return matches;
  } else {
    return false;
  }
}

exports.handler = async (event, context, callback) => {
  // Establish options
  const options = {
    onlyCsvResponse: event.queryStringParameters.only_csv == 1, 
    multiValueSeperator: event.queryStringParameters.multi_value_seperator || '|',
    multiOptionSeperator: event.queryStringParameters.multi_option_seperator || '$',
  };

  // Create an array to store modified rows in
  const modifiedData = [];

  try {
    // Pass the CSV data provided in the body of the request
    const data = parseCsv(event.body);

    // Parse headers for any info needed later
    const additionalAttributeHeaders = findAdditionalAttributeHeaders(Object.keys(data[0]));

    // Index SKUs
    const skuIndex = {};
    data.forEach((row, i) => {
      if (typeof skuIndex[row.sku] !== 'undefined') {
        throw new Error(`Duplicate SKU: ${row.sku}`);
      }

      skuIndex[row.sku] = i
    });

    // Interdepency info storage
    const configurableChildrenByParent = {};
    const configurableLabelsByParent = {};
    const configurableParentByChildren = {};
    const configurableAttributeValuesByChildren = {};

    // Iterate over rows and store info about interdependencies
    data.forEach(row => {
      // Establish configurable parent/child relationships
      if (row.parent_sku && row.configurable_attributes) {
        if (!configurableChildrenByParent[row.parent_sku]) {
          configurableChildrenByParent[row.parent_sku] = [];
        }

        const configurableAttributes = parseConfigurableAttributes(row.configurable_attributes);

        // Index children simples of the parent configurable
        configurableChildrenByParent[row.parent_sku].push(row.sku);

        // Index attribute labels for the configurable parent
        configurableLabelsByParent[row.parent_sku] = configurableAttributes.map(attr => `${attr.attributeCode}=${attr.label}`).join(options.multiValueSeperator);

        // Index the configurable parent for this simple
        configurableParentByChildren[row.sku] = row.parent_sku;

        // Index attribute values for configurable simples
        configurableAttributeValuesByChildren[row.sku] = {};
        configurableAttributes.forEach(attr => {
          if (!row[attr.attributeCode]) {
            throw new Error(`Couldn't find value for ${attr.attributeCode} on child simple product ${row.sku}`);
          }

          configurableAttributeValuesByChildren[row.sku][attr.attributeCode] = row[attr.attributeCode];
        });
      }
    });

    // Iterate over rows and make modifications
    data.forEach(row => {
      // Add any placeholder columns, for consistency
      if (Object.keys(configurableChildrenByParent).length) {
        row['configurable_variations'] = '';
        row['configurable_variation_labels'] = '';
      }

      if (additionalAttributeHeaders) {
        row['additional_attributes'] = '';
      }
      
      // Add configurable data to parent
      if (configurableChildrenByParent[row.sku]) {
        row['configurable_variations'] = configurableChildrenByParent[row.sku].map(childSku => {
          const variations = Object.assign({
            sku: childSku
          }, configurableAttributeValuesByChildren[childSku]);

          return convertColumnsToStringKeyValue(variations, options.multiValueSeperator);
        })
        .join(options.multiOptionSeperator);
        row['configurable_variation_labels'] = configurableLabelsByParent[row.sku];
      }

      // Squash additional attribute keys/values
      if (additionalAttributeHeaders) {
        const additionalAttributes = extractColumns(row, additionalAttributeHeaders);
        row['additional_attributes'] = convertColumnsToStringKeyValue(additionalAttributes, options.multiValueSeperator);
      }


      // Remove any and all fake columns
      row = purgeColumns(row, [
        'parent_sku',
        'configurable_attributes'
      ]);
      row = purgeColumns(row, additionalAttributeHeaders);

      // Add final, modified, row to our storage array
      modifiedData.push(row);
    });
  } catch (e) {
    // Return error feedback
    callback(null, { 
      statusCode: 401, 
      body: JSON.stringify({ 
        status: 'error',
        message: e.message
      })
    });
    return;
  }

  const csvResponse = Papa.unparse(modifiedData);

  if (options.onlyCsvResponse) {
    // Send response with only the CSV in the body
    callback(null, { 
      statusCode: 200, 
      body: csvResponse 
    });
  } else {
    // Send CSV in JSON response
    callback(null, { 
      statusCode: 200, 
      body: JSON.stringify({
        status: 'success',
        data: csvResponse
      })
    });
  }
}