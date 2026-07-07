const fs = require('fs');
let sql = fs.readFileSync('supabase/setup.sql', 'utf8');

sql = sql.replace(/CREATE POLICY "([^"]+)" ON ([a-zA-Z0-9_\.]+)/g, (match, p1, p2) => {
    return `DROP POLICY IF EXISTS "${p1}" ON ${p2};\n${match}`;
});

fs.writeFileSync('supabase/setup.sql', sql);
