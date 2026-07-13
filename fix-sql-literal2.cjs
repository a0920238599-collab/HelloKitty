const fs = require('fs');
let content = fs.readFileSync('supabase/setup.sql', 'utf8');

content = content.split('RETURNS INTEGER AS $\nDECLARE').join('RETURNS INTEGER AS $$\nDECLARE');
content = content.split('RETURNS BOOLEAN AS $\nDECLARE').join('RETURNS BOOLEAN AS $$\nDECLARE');
content = content.split('END;\n$ LANGUAGE').join('END;\n$$ LANGUAGE');

fs.writeFileSync('supabase/setup.sql', content);
