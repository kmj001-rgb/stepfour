// validate.js - MasterScraper Extension Validation Script
// Checks for syntax errors and common issues

const fs = require('fs');
const path = require('path');

// Files to validate
const files = [
    'manifest.json',
    'background.js',
    'content.js',
    'dashboard.js',
    'dashboard.html'
];

// Validation results
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

console.log('🔍 MasterScraper Extension Validation\n');

// Validate each file
files.forEach(file => {
    console.log(`Checking ${file}...`);
    
    try {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for syntax errors in JavaScript files
        if (file.endsWith('.js')) {
            try {
                // Basic syntax check
                eval('(function() { ' + content + ' })');
                console.log(`✅ ${file} - Syntax OK`);
                results.passed++;
            } catch (error) {
                console.log(`❌ ${file} - Syntax Error: ${error.message}`);
                results.failed++;
                results.errors.push(`${file}: ${error.message}`);
            }
        }
        
        // Check JSON files
        else if (file.endsWith('.json')) {
            try {
                JSON.parse(content);
                console.log(`✅ ${file} - JSON Valid`);
                results.passed++;
            } catch (error) {
                console.log(`❌ ${file} - JSON Error: ${error.message}`);
                results.failed++;
                results.errors.push(`${file}: ${error.message}`);
            }
        }
        
        // Check HTML files
        else if (file.endsWith('.html')) {
            // Basic HTML validation
            if (content.includes('<!DOCTYPE html>') && 
                content.includes('<html') && 
                content.includes('</html>')) {
                console.log(`✅ ${file} - HTML Structure OK`);
                results.passed++;
            } else {
                console.log(`❌ ${file} - HTML Structure Issues`);
                results.failed++;
                results.errors.push(`${file}: HTML structure issues`);
            }
        }
        
    } catch (error) {
        console.log(`❌ ${file} - File Read Error: ${error.message}`);
        results.failed++;
        results.errors.push(`${file}: ${error.message}`);
    }
});

// Check required files exist
console.log('\n📁 Checking required files...');

const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'dashboard.html',
    'dashboard.js',
    'icons/icon16.png',
    'icons/icon48.png',
    'icons/icon128.png'
];

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} - Exists`);
        results.passed++;
    } else {
        console.log(`❌ ${file} - Missing`);
        results.failed++;
        results.errors.push(`Missing file: ${file}`);
    }
});

// Check manifest.json structure
console.log('\n📋 Validating manifest.json structure...');

try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    
    const requiredFields = [
        'manifest_version',
        'name',
        'version',
        'description',
        'action',
        'background',
        'permissions',
        'host_permissions',
        'content_scripts',
        'icons'
    ];
    
    requiredFields.forEach(field => {
        if (manifest[field]) {
            console.log(`✅ ${field} - Present`);
            results.passed++;
        } else {
            console.log(`❌ ${field} - Missing`);
            results.failed++;
            results.errors.push(`Missing manifest field: ${field}`);
        }
    });
    
    // Check specific values
    if (manifest.manifest_version === 3) {
        console.log('✅ manifest_version - Correct (V3)');
        results.passed++;
    } else {
        console.log('❌ manifest_version - Should be 3');
        results.failed++;
        results.errors.push('manifest_version should be 3');
    }
    
    if (manifest.name === 'MasterScraper') {
        console.log('✅ name - Correct');
        results.passed++;
    } else {
        console.log('❌ name - Should be "MasterScraper"');
        results.failed++;
        results.errors.push('name should be "MasterScraper"');
    }
    
} catch (error) {
    console.log(`❌ Manifest validation failed: ${error.message}`);
    results.failed++;
    results.errors.push(`Manifest validation: ${error.message}`);
}

// Summary
console.log('\n📊 Validation Summary');
console.log('====================');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.errors.length > 0) {
    console.log('\n🚨 Errors Found:');
    results.errors.forEach(error => {
        console.log(`  - ${error}`);
    });
    console.log('\n❌ Extension has issues that need to be fixed.');
} else {
    console.log('\n🎉 All validations passed! Extension is ready for use.');
}

console.log('\n📝 Next Steps:');
console.log('1. Load the extension in Chrome (chrome://extensions/)');
console.log('2. Enable Developer mode');
console.log('3. Click "Load unpacked" and select this folder');
console.log('4. Test the extension on a gallery page');