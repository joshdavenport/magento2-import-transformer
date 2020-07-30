const formEncode = async (data) => {
    const formData = {};
  
    if (data.file) {
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(data.file); 
        reader.onloadend = function() {
            var base64data = reader.result;                
            data.file = base64data;
            resolve();
        }
      });
    }
  
    Object.keys(data).forEach(dataKey => formData[dataKey] = data[dataKey]);
  
    return JSON.stringify(formData);
};

export default formEncode;