const stripBom = require('strip-bom');
const XLSX = require('xlsx');

exports.handler = async (event, context, callback) => {
  console.log('[PROCESS] Starting handler');

  // Establish options
  const options = {
    onlyCsvResponse: event.queryStringParameters.only_csv == 1, 
  };

  console.log('[PROCESS] Processed options');

  try {
    let csvResponse = '';

    console.log('[PROCESS] Parsing body');

    let input = JSON.parse(event.body);

    console.log('[PROCESS] Finished parsing body');

    switch (input.format) {
      case 'csv':
        console.log('[PROCESS] Processing base64 CSV');
        const csvBuffer = Buffer.from(input.file.replace('data:text/csv;base64,', '').trim(), 'base64');
        csvResponse = stripBom(csvBuffer.toString('utf8'));
        console.log('[PROCESS] Finished processing base64 CSV');
        break;
      case 'xlsx':
        console.log('[PROCESS] Processing base64 XLSX');
        const workbook = XLSX.read(input.file.replace('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,', ''), { type: 'base64' });
        console.log('[PROCESS] Converting XLSX to CSV');
        csvResponse = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        console.log('[PROCESS] Finished processing and converting base64 XLSX');
        break;
    }

    console.log('[PROCESS] Sending response');
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
  console.log('[PROCESS] Finished handler');
}