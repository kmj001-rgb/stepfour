# Scrapy

A Chrome extension for filtering and saving data from websites in various formats (JSON, CSV, TXT, XML, SQL, Markdown).

![Scrapy Extension](screenshots/screenshot-main.png)

## Features

- Scrape data from any website with just a few clicks
- Filter by element types (headings, paragraphs, images, links, tables, lists, forms, metadata)
- Use custom CSS and XPath selectors for precise data targeting
- Clean and normalize data with built-in options
- Grab data from multiple pages through pagination
- Define custom schemas for structured data collection
- Export to multiple formats (JSON, CSV, TXT, XML, SQL, Markdown)
- API integration to send data directly to external services
- Save and reuse configurations with templates
- Dark mode support

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The Scrapy icon should now appear in your browser toolbar

## Basic Usage

1. Navigate to any website you want to scrape
2. Click the Scrapy extension icon
3. Select the data filters you're interested in (like headings, images, links)
4. Choose your preferred export format
5. Click "Scrape Data"
6. Once scraping is complete, click "Download" to save the data

## Feature Tutorials

### Basic Data Filtering

The "Basic" tab lets you quickly select what types of elements to scrape:

- **Headings**: Grabs all heading elements (h1, h2, h3, etc.)
- **Paragraphs**: Extracts paragraph text from the page
- **Images**: Collects image URLs, alt text, and dimensions
- **Links**: Gathers all links with their text and destinations
- **Tables**: Extracts tabular data with headers and rows
- **Lists**: Grabs ordered and unordered lists
- **Forms**: Collects form fields and attributes
- **Metadata**: Extracts meta tags from the page head

This is great for quickly grabbing general content from a page. Simply check or uncheck boxes to control what data you collect.

### Using CSS and XPath Selectors

When you need more precise targeting, switch to the "Advanced" tab and use custom selectors:

#### CSS Selector Examples:

- `.product-card` - Selects all elements with class "product-card"
- `.products > .item .price` - Selects price elements within item containers
- `article h2` - Selects all h2 headings within article elements
- `table.data tr:nth-child(even)` - Selects even rows from tables with class "data"

CSS selectors are easier to write if you're familiar with CSS for styling web pages.

#### XPath Selector Examples:

- `//div[@class="product"]` - Selects all div elements with class "product"
- `//h3[contains(text(),"Price")]` - Selects h3 elements containing the text "Price"
- `//table//tr[position() > 1]` - Selects all table rows except the first one
- `//ul[@id="menu"]/li/a/@href` - Extracts href attributes from links in a menu

XPath is more powerful when you need to select elements based on their content or need complex conditions.

**Tip**: Use your browser's developer tools to test selectors. Right-click an element, choose "Inspect", then use the Elements panel to explore the page structure.

### Data Cleaning Options

The "Advanced" tab also offers options to clean your scraped data:

- **Remove excess whitespace**: Trims extra spaces, tabs, and line breaks, converting multiple spaces to a single space. Great for cleaning up messy text formatting.

- **Strip HTML tags**: Removes HTML tags from text content. Useful when you want plain text without any markup.

- **Normalize text**: Converts text to lowercase and removes accent marks. This helps when you need standardized text for analysis or comparison.

Example: A raw text like `"  <span>Product Name</span>  \n  "` would become:
- With whitespace removal: `"<span>Product Name</span>"`
- With HTML stripping: `"  Product Name  \n  "`
- With both options: `"Product Name"`
- With all three options: `"product name"`

### Pagination Support

Scrape data across multiple pages with the pagination feature:

1. Check "Enable pagination scraping" in the Advanced tab
2. Enter a selector that targets the "Next" link or button:
   - CSS example: `.pagination .next` or `a.next-page`
   - XPath example: `//a[contains(text(), "Next")]` or `//a[@rel="next"]`
3. Set the maximum number of pages to scrape
4. Specify a delay between page loads (in milliseconds)

**When to use pagination:**
- Product catalogs spanning multiple pages
- Search results with pagination
- Forums or comment sections
- News article archives

**Example scenario:** Scraping an e-commerce category with 5 pages of products:
- Enable pagination
- Set selector to `.pagination-container .next-page`
- Set max pages to 5
- Set delay to 1500 (1.5 seconds)

Scrapy will load each page, scrape the data, and automatically continue to the next page until it reaches page 5 or can't find the "next" button.

### Schema Definition

The Schema tab lets you create a structured data model for more organized results:

1. Define field names and types
2. Specify selectors for each field
3. Scrapy will extract data according to your schema

#### Schema Example 1: Product Listings

Field Name | Type | Selector
-----------|------|----------
title | text | .product-item h3
price | number | .product-item .price
rating | number | .product-item .rating
inStock | boolean | .product-item .stock-status
imageUrl | image | .product-item img

This schema would create structured data like:
```json
[
  {
    "title": "Wireless Headphones",
    "price": 49.99,
    "rating": 4.5,
    "inStock": true,
    "imageUrl": "https://example.com/images/headphones.jpg"
  },
  {
    "title": "Bluetooth Speaker",
    "price": 89.99,
    "rating": 4.2,
    "inStock": false,
    "imageUrl": "https://example.com/images/speaker.jpg"
  }
]
```

#### Schema Example 2: News Articles

Field Name | Type | Selector
-----------|------|----------
headline | text | article h2
author | text | .article-meta .author
date | date | .article-meta .date
summary | text | article .summary
category | text | .article-category
url | url | article a.read-more

#### Parent-Child Relationships in Schemas

You can create parent-child relationships in your schema using the `>` operator in selectors:

- For a list of products: `.product-card` as parent selector
  - `.product-card > .title` for product title
  - `.product-card > .price` for product price

This extracts data for each product as a separate item in the results.

### API Integration

Send your scraped data directly to an external API:

1. Go to the "Export & Templates" tab
2. Enter your API endpoint URL
3. Select the HTTP method (POST, PUT, PATCH)
4. Enter any required headers as JSON
5. Click "Test Connection" to verify
6. After scraping data, click "Send Data to API"

**Example API configuration:**

Endpoint: `https://api.myservice.com/data`  
Method: `POST`  
Headers:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer my-api-token",
  "x-api-key": "abc123def456"
}
```

This feature is perfect for:
- Sending data directly to your database
- Integrating with data processing services
- Triggering automated workflows
- Updating inventory or content management systems

### Template System

Save your scraping configurations to reuse later:

1. Set up your filters, selectors, schema, etc.
2. Go to the "Export & Templates" tab
3. Enter a name and description for your template
4. Choose which settings to include
5. Click "Save Template"

To use a saved template:
1. Select it from the dropdown
2. Click "Load"
3. All the saved settings will be applied

This is super handy when:
- You frequently scrape similar websites
- You have complex selectors or schemas
- You're working with a team and want to share configurations
- You need to re-run the same scrape periodically

## Export Formats

Scrapy supports exporting data in multiple formats:

- **JSON**: Universal format for structured data
- **CSV**: Great for importing into spreadsheet software
- **TXT**: Simple plain text format
- **XML**: Structured format for data exchange
- **SQL**: Insert statements for database import
- **Markdown**: Human-readable formatted text

Each format has its strengths depending on your needs.

## Tips & Tricks

- **Inspect before scraping**: Use browser dev tools (F12) to examine the page structure
- **Start simple**: Begin with basic filters before trying complex selectors
- **Use templates**: Save your configurations for similar websites
- **Test selectors**: Try selectors on a small section before scraping entire pages
- **Set reasonable delays**: When using pagination, respect the website by using longer delays (1-2 seconds)
- **Preview data**: Use the "Show Preview" button to check your data before downloading

## Troubleshooting

**No data scraped**
- Ensure you've selected appropriate filters or selectors
- Check if the website uses JavaScript to load content (some content may not be accessible immediately)
- Try using more general selectors or basic filters

**Pagination not working**
- Verify your "next page" selector by testing it in dev tools
- Some sites use JavaScript navigation that may not work with the pagination feature
- Try increasing the delay between page loads

**API connection failed**
- Check that your endpoint URL is correct
- Verify your headers format (valid JSON)
- Ensure you have the right permissions to access the API

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 