import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const sourceRoot = path.join(root, "src")
const componentsRoot = path.join(sourceRoot, "components")
const sharedComponentGroups = new Set(["layout", "navigation", "ui"])

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)))
    } else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

const errors = []
const componentEntries = await readdir(componentsRoot, { withFileTypes: true })

for (const entry of componentEntries) {
  if (!entry.isDirectory() || !sharedComponentGroups.has(entry.name)) {
    errors.push(
      `src/components/${entry.name} is not a shared component group; move domain code to src/features`,
    )
  }
}

const sourceFiles = await collectSourceFiles(sourceRoot)
const retiredImports = [
  "AdminCommandPalette",
  "FounderDashboard",
  "GuardedOpsShell",
  "KpiCard",
  "OpsPageHeader",
  "OpsShell",
  "StateBlock",
  "Toast",
]

for (const file of sourceFiles) {
  const relativePath = path.relative(root, file).split(path.sep).join("/")
  const source = await readFile(file, "utf8")

  for (const component of retiredImports) {
    if (source.includes(`@/components/${component}`)) {
      errors.push(`${relativePath} imports the retired flat component path for ${component}`)
    }
  }

  if (relativePath.startsWith("src/features/") && source.includes('"@/app/')) {
    errors.push(`${relativePath} imports from the route layer`)
  }

  if (
    relativePath.startsWith("src/lib/") &&
    /["']@\/(?:app|components|features)\//.test(source)
  ) {
    errors.push(`${relativePath} makes the data layer depend on UI code`)
  }
}

if (errors.length > 0) {
  console.error("[architecture] Admin boundary violations:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("[architecture] Admin boundaries OK")
