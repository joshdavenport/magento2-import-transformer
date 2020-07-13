import React, { Fragment, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import FileSaver from 'file-saver';
import queryString from 'query-string';
import styled, { createGlobalStyle } from 'styled-components';
import formEncode from './util/form-encode';
const formats = require('./data/formats.json');

const GlobalStyle = createGlobalStyle`
  html, body {
    height: 100%;
  }

  body {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
`;

// Styles
const AppContainer = styled.div`
max-width: 500px;
margin: 0 auto;
`;

const FormField = styled.div`
margin: 20px 0;

label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

input, select {
  margin-top: 5px;
}
`;

const FileDrop = styled.div`
border: 3px dotted #ccc;
display: flex;
flex-direction:column;
align-items: center;
justify-content: center;
padding: 40px;
text-align: center;
`;

const FileDropActive = styled(FileDrop)`
background: #aeddae;
border-color: #56ae56;
`;

const FileDropIcon = styled.div`
font-size: 32px;
`;

const FileDropName = styled.div`
font-size: 8px;
`;

function App() {
  // State hooks
  const [format, setFormat] = useState('none');
  const [multipleOptionSeperator, setMultipleOptionSeperator] = useState('|');
  const [multipleValueSeperator, setMultipleValueSeperator] = useState('$');
  const [autoStockStatusThreshold, setAutoStockStatusThreshold] = useState();
  const [file, setFile] = useState({});

  // Submission handling
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const data = { format, file };
    const body = await formEncode(data);
  
    // 2 step process is as follows:
    // 1. Process - Normalise formats so that we have a CSV to work with for the next step
    // 2. Transform - Transform the CSV with changes

    // Send data to process step
    const processResponse = await(await fetch('/.netlify/functions/process', {
      method: 'POST',
      body
    })).json();

    // Build argumenst for the transform step
    const transformArguments = {
      multi_value_seperator: multipleOptionSeperator,
      multi_option_seperator: multipleValueSeperator
    };

    if(autoStockStatusThreshold) {
      transformArguments.auto_stock_status_threshold = autoStockStatusThreshold;
    }

    const transformQueryString = queryString.stringify(transformArguments);

    // Send data to the transform step
    const transformResponse = await(await fetch(`/.netlify/functions/transform?${transformQueryString}`, {
      method: 'POST',
      body: processResponse.data
    })).json();
    
    // With the transformed data, create a client side download
    const csvBlob = new Blob([transformResponse.data], { type: 'text/csv;charset=utf-8' })
    FileSaver.saveAs(csvBlob, 'magento2-import-transformed.csv');
  };

  // Handle file drops
  const onDrop = acceptedFiles => {
    const fileExtension = acceptedFiles[0].name.toLowerCase().match(/\.([a-z]*)$/)[1];

    if(fileExtension && Object.keys(formats).indexOf(fileExtension) !== -1) {
      setFile(acceptedFiles[0]);
      setFormat(fileExtension);
    }
  };
  const { getRootProps, getInputProps, open, acceptedFiles, isDragActive } = useDropzone({ 
    onDrop,
    multiple: false 
  });
  
  const FileDropComponent = acceptedFiles.length ? FileDropActive : FileDrop;


  // Render
  return (
    <Fragment>
      <GlobalStyle />
      <AppContainer>
        <form onSubmit={handleSubmit}>
          <FormField>
            <div {...getRootProps()}>
              <FileDropComponent>
                <input {...getInputProps()} />  
                {
                  acceptedFiles.length === 0 && (
                    isDragActive ?
                      <div>Drop the files here ...</div> :
                      <div>Drag 'n' drop some files here, or click to select files</div>
                  )
                }
                {
                  acceptedFiles.length === 0 &&
                    <button type="button" onClick={open}>
                      Open File Dialog
                    </button>
                }
                {
                  acceptedFiles.length > 0 &&
                    <Fragment>
                      <FileDropIcon>📄</FileDropIcon>
                      <FileDropName>({ acceptedFiles[0].name })</FileDropName>
                    </Fragment>
                }
              </FileDropComponent>
            </div>
          </FormField>
          <FormField>
            <label>
              Format
              <select value={format} onChange={e => setFormat(e.target.value)}>
                {Object.keys(formats).map(extension => 
                  <option key={extension} value={extension}>{formats[extension]}</option>
                )}
              </select>
            </label>
          </FormField>
          <FormField>
            <label>
              Auto stock status threshold
              <input value={autoStockStatusThreshold} type="number" onChange={e => setAutoStockStatusThreshold(e.target.value)} />
            </label>
          </FormField>
          <FormField>
            <label>
              Multiple option seperator
              <input value={multipleOptionSeperator} onChange={e => setMultipleOptionSeperator(e.target.value)} />
            </label>
          </FormField>
          <FormField>
            <label>
              Multiple value seperator
              <input value={multipleValueSeperator} onChange={e => setMultipleValueSeperator(e.target.value)} />
            </label>
          </FormField>
          <FormField>
            <button type="submit">Transform</button>
          </FormField>
        </form>
      </AppContainer>
    </Fragment>
  );
}

export default App;