const fs = require("fs");
const path = require("path");

const distEntry = path.join(__dirname, "dist", "server.js");

if (!fs.existsSync(distEntry)) {
  console.error("Build não encontrado. Rode `npm run build` antes de executar `node serves.js`.");
  process.exitCode = 1;
} else {
  require(distEntry);
}

