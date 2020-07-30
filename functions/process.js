const stripBom = require('strip-bom');
const XLSX = require('xlsx');

exports.handler = async (event, context, callback) => {
  // Establish options
  const options = {
    onlyCsvResponse: event.queryStringParameters.only_csv == 1, 
  };

  try {
    let csvResponse = '';

    let input = JSON.parse(event.body);

    switch (input.format) {
      case 'csv':
        const csvBuffer = Buffer.from(input.file.replace('data:text/csv;base64,', '').trim(), 'base64');
        csvResponse = stripBom(csvBuffer.toString('utf8'));
        break;
      case 'xlsx':
        const workbook = XLSX.read(input.file.replace('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,', ''), { type: 'base64' });
        csvResponse = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        break;
    }

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
  } catch (e) {
    callback(null, { 
      statusCode: 401, 
      body: JSON.stringify({ 
        status: 'error',
        message: e.message
      })
    });
  }
}