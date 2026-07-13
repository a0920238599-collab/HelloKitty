const fs = require('fs');
let content = fs.readFileSync('supabase/setup.sql', 'utf8');

content = content.replace('RETURNS INTEGER AS $\nDECLARE', 'RETURNS INTEGER AS $$\nDECLARE');
content = content.replace('RETURNS BOOLEAN AS $\nDECLARE', 'RETURNS BOOLEAN AS $$\nDECLARE');
content = content.replace('END;\n$ LANGUAGE plpgsql SECURITY DEFINER;', 'END;\n$$ LANGUAGE plpgsql SECURITY DEFINER;');

fs.writeFileSync('supabase/setup.sql', content);
