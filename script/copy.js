const fs = require('fs');
const path = require('path');

// Configuration
const projectsRoot = path.join(__dirname, '..', 'apps', 'mongodb-mcp');
const outputFile = path.join(__dirname, '..', 'source-code-dump.txt');

// File extensions to include
const includeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html'];
// Directories to exclude
const excludeDirs = ['node_modules', 'dist', '.git', 'build', 'coverage', '.vscode', '.json'];
// Files to exclude (by exact name)
const excludeFiles = ['package-lock.json'];

/**
 * Get all files recursively
 */
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file) && !file.startsWith('.')) {
        getAllFiles(filePath, fileList);
      }
    } else {
      // Check if file should be excluded by name
      if (excludeFiles.includes(file)) {
        return;
      }
      
      const ext = path.extname(file);
      if (includeExtensions.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Get relative path from root
 */
function getRelativePath(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath);
}

/**
 * Format file content with header
 */
function formatFileContent(filePath, content) {
  const relativePath = getRelativePath(filePath);
  const separator = '='.repeat(100);
  return `${separator}\n📁 FILE: ${relativePath}\n${separator}\n\n${content}\n\n`;
}

/**
 * Get folder structure as string
 */
function getFolderStructure(dir, prefix = '', structure = '') {
  if (!fs.existsSync(dir)) return structure;
  
  const files = fs.readdirSync(dir);
  const filteredFiles = files.filter(f => !excludeDirs.includes(f) && !f.startsWith('.'));
  
  filteredFiles.forEach((file, index) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const isLastItem = index === filteredFiles.length - 1;
    const marker = isLastItem ? '└── ' : '├── ';
    
    if (stat.isDirectory()) {
      structure += prefix + marker + '📁 ' + file + '\n';
      const newPrefix = prefix + (isLastItem ? '    ' : '│   ');
      structure = getFolderStructure(filePath, newPrefix, structure);
    } else {
      // Skip excluded files in folder structure display
      if (excludeFiles.includes(file)) {
        return;
      }
      
      const ext = path.extname(file);
      if (includeExtensions.includes(ext)) {
        structure += prefix + marker + '📄 ' + file + '\n';
      }
    }
  });
  
  return structure;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning source folder...');
  console.log(`📁 Location: ${projectsRoot}\n`);
  
  // Check if directory exists
  if (!fs.existsSync(projectsRoot)) {
    console.error(`❌ Source folder not found: ${projectsRoot}`);
    return;
  }
  
  // Get all files
  const allFiles = getAllFiles(projectsRoot);
  
  if (allFiles.length === 0) {
    console.log('❌ No matching files found.');
    return;
  }
  
  console.log(`📊 Total files found: ${allFiles.length}`);
  
  // Create output content
  let output = '';
  
  // Add header
  output += '='.repeat(100) + '\n';
  output += '🚀 UNILOGGER SOURCE CODE DUMP\n';
  output += '='.repeat(100) + '\n';
  output += `📅 Generated: ${new Date().toLocaleString()}\n`;
  output += `📁 Root: src/\n`;
  output += `📊 Total Files: ${allFiles.length}\n`;
  output += '='.repeat(100) + '\n\n';
  
  // Add table of contents
  output += '📑 TABLE OF CONTENTS\n';
  output += '-'.repeat(50) + '\n';
  
  allFiles.sort().forEach((file, index) => {
    const relativePath = getRelativePath(file);
    output += `${index + 1}. 📄 ${relativePath}\n`;
  });
  
  output += '\n' + '='.repeat(100) + '\n\n';
  
  // Add folder structure
  output += '📁 FOLDER STRUCTURE\n';
  output += '-'.repeat(50) + '\n';
  output += `src/\n`;
  output += getFolderStructure(projectsRoot, '    ');
  output += '\n' + '='.repeat(100) + '\n\n';
  
  // Add file contents
  output += '📄 FILE CONTENTS\n';
  output += '-'.repeat(50) + '\n\n';
  
  // Process each file
  allFiles.sort().forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      output += formatFileContent(filePath, content);
    } catch (error) {
      output += formatFileContent(filePath, `❌ Error reading file: ${error.message}\n`);
    }
  });
  
  // Write to file
  fs.writeFileSync(outputFile, output);
  
  console.log(`\n✅ Code dump created successfully!`);
  console.log(`📄 Output file: ${outputFile}`);
  console.log(`📊 Total characters: ${output.length.toLocaleString()}`);
  console.log(`📊 Total lines: ${output.split('\n').length.toLocaleString()}`);
  
  // Print summary by file type
  console.log('\n📊 File Types Summary:');
  console.log('-'.repeat(50));
  const fileTypes = {};
  allFiles.forEach(file => {
    const ext = path.extname(file);
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });
  
  Object.entries(fileTypes).sort().forEach(([ext, count]) => {
    console.log(`${ext || 'no extension'}: ${count} files`);
  });
  
  // Print summary by folder
  console.log('\n📁 Folder Summary:');
  console.log('-'.repeat(50));
  const folders = {};
  allFiles.forEach(file => {
    const relativePath = getRelativePath(file);
    const folder = path.dirname(relativePath);
    folders[folder] = (folders[folder] || 0) + 1;
  });
  
  Object.entries(folders).sort().forEach(([folder, count]) => {
    console.log(`${folder}/: ${count} files`);
  });
}

// Run the script
main().catch(console.error);