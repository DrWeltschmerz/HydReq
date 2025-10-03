(function(){
  function unquoteNumericKeys(yamlText){
    if (!yamlText) return yamlText;
    return yamlText.split('\n').map(function(line){
      var m = line.match(/^(\s*)("|')(\d+)("|')\s*:\s*(.*)$/);
      if (m) return m[1] + m[3] + ': ' + m[5];
      return line;
    }).join('\n');
  }

  function cleanForSerialization(obj){
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)){
      var cleanedArr = obj.map(cleanForSerialization).filter(function(item){ return item !== undefined; });
      return cleanedArr.length > 0 ? cleanedArr : undefined;
    }
    if (typeof obj === 'object'){
      var cleanedObj = {};
      Object.keys(obj).forEach(function(key){
        var value = obj[key];
        var cleanedValue = cleanForSerialization(value);
        if (cleanedValue !== undefined && cleanedValue !== '' && cleanedValue !== null){
          if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0){
            return; // skip empty object
          }
          if (Array.isArray(cleanedValue) && cleanedValue.length === 0){
            return; // skip empty array
          }
          cleanedObj[key] = cleanedValue;
        }
      });
      return Object.keys(cleanedObj).length > 0 ? cleanedObj : undefined;
    }
    return (obj === '') ? undefined : obj;
  }

  function toYaml(working){
    try{
      var cleaned = cleanForSerialization(working || {});
      var yamlText = jsyaml.dump(cleaned || {}, { noRefs: true, quotingType: '"' });
      return unquoteNumericKeys(yamlText || '');
    }catch(e){ return ''; }
  }

  function fromYaml(text){
    try{ return jsyaml.load(text || '') || {}; }catch(e){ return {}; }
  }

  window.hydreqEditorSerialize = window.hydreqEditorSerialize || { unquoteNumericKeys, cleanForSerialization, toYaml, fromYaml };
})();
