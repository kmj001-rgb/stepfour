#!/bin/bash

echo "🔍 Validating Chrome Extension..."
echo ""

# Check manifest.json
echo "1. Validating manifest.json..."
if python3 -m json.tool manifest.json > /dev/null 2>&1; then
    echo "   ✅ Manifest JSON is valid"
else
    echo "   ❌ Manifest JSON is invalid"
    exit 1
fi

# Check required files exist
echo ""
echo "2. Checking required files..."
required_files=(
    "manifest.json"
    "background.js"
    "content.js"
    "src/content/paginationEngine.js"
    "src/content/content.js"
    "src/ui/debugUI.js"
    "src/background/paginationCoordinator.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file missing"
        exit 1
    fi
done

# Check syntax of JavaScript files
echo ""
echo "3. Checking JavaScript syntax..."
js_files=(
    "background.js"
    "content.js"
    "src/content/paginationEngine.js"
    "src/content/content.js"
    "src/content/strategies/queryStringStrategy.js"
    "src/content/strategies/nextButtonStrategy.js"
    "src/content/strategies/pathBasedStrategy.js"
    "src/content/strategies/loadMoreStrategy.js"
    "src/content/validators/contentHashValidator.js"
    "src/content/validators/urlValidator.js"
    "src/content/navigators/urlNavigator.js"
    "src/content/navigators/clickNavigator.js"
    "src/lib/paginationState.js"
    "src/ui/debugUI.js"
)

for file in "${js_files[@]}"; do
    if node -c "$file" > /dev/null 2>&1; then
        echo "   ✅ $file syntax OK"
    else
        echo "   ❌ $file has syntax errors"
        exit 1
    fi
done

# Check icons exist
echo ""
echo "4. Checking icons..."
icon_sizes=(16 32 48 128)
for size in "${icon_sizes[@]}"; do
    if [ -f "icons/${size}.png" ]; then
        echo "   ✅ icons/${size}.png exists"
    else
        echo "   ⚠️  icons/${size}.png missing (recommended but not required)"
    fi
done

echo ""
echo "✅ Extension validation complete!"
echo ""
echo "📦 Ready to load as unpacked extension in Chrome"
echo "   1. Open chrome://extensions/"
echo "   2. Enable Developer mode"
echo "   3. Click 'Load unpacked'"
echo "   4. Select the chromextension1 folder"
echo ""
