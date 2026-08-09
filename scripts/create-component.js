const fs = require("fs");
const path = require("path");

const componentName = process.argv[2];

if (!componentName) {
  console.log("Usage: npm run component ComponentName");
  process.exit(1);
}

const componentDir = path.join(
  __dirname,
  "..",
  "src",
  "components",
  componentName
);

if (fs.existsSync(componentDir)) {
  console.log("❌ Component already exists!");
  process.exit(1);
}

fs.mkdirSync(componentDir, { recursive: true });

const jsx = `import "./${componentName}.css";

const ${componentName} = () => {
  return (
    <div className="${componentName}">

    </div>
  );
};

export default ${componentName};
`;

const css = `.${componentName} {

}
`;

fs.writeFileSync(
  path.join(componentDir, `${componentName}.jsx`),
  jsx
);

fs.writeFileSync(
  path.join(componentDir, `${componentName}.css`),
  css
);

console.log(`✅ ${componentName} created successfully!`);