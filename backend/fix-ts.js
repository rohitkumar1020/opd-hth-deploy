const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.join(__dirname, 'src/modules');

const files = glob.sync(`${root}/**/*.ts`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace req.params.SOMETHING with (req.params.SOMETHING as string) in 'where:' clauses
  content = content.replace(/where:\s*{\s*([^:]+):\s*req\.params\.([a-zA-Z0-9_]+)\s*}/g, 'where: { $1: req.params.$2 as string }');
  
  // Replace direct usage in update data where missing 'as string' might fail
  content = content.replace(/where:\s*{\s*([^:]+):\s*req\.params\.([a-zA-Z0-9_]+)\s*,\s*([^:]+):\s*([^}]+)}/g, 'where: { $1: req.params.$2 as string, $3: $4 }');

  // Any other req.params.xxx outside where: { id: req.params.xxx } that we see in TS errors
  // E.g. where: { id: req.params.id } might already be replaced.
  // We'll also fix `req.query` issues if any, but params are main.
  
  // specifically fix `const doctorId = req.params.doctorId;`
  content = content.replace(/const ([a-zA-Z0-9_]+) = req\.params\.([a-zA-Z0-9_]+);/g, 'const $1 = req.params.$2 as string;');

  // fix `triageId: token.triageId` being accessed on ANY in consultation
  content = content.replace(/if\s*\(\(consultation\s*as\s*any\)\.token\.triageId\)/g, 'if ((consultation as any).token?.triageId)');
  
  fs.writeFileSync(file, content);
});
console.log('Fixed req.params TS errors');
