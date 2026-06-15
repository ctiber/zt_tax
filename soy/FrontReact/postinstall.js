const fse = require('fs-extra');
const path = require('path');
const topDir = __dirname;
if(fse.existsSync(path.join(topDir, 'public', 'tinymce'))){
  console.log("TinyMCE already exists");
  return;
}
console.log("Hosting TinyMCE locally...");
fse.emptyDirSync(path.join(topDir, 'public', 'tinymce'));
fse.copySync(path.join(topDir, 'node_modules', 'tinymce'), path.join(topDir, 'public', 'tinymce'), { overwrite: true });