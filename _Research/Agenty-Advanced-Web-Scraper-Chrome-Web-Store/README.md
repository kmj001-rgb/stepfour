# Agenty Chrome Extension
Agenty chrome extension to setup scraping, crawling and change detection agents - https://chrome.google.com/webstore/detail/agenty-advanced-web-scrap/gpolcofcjjiooogejfbaamdgmgfehgff

A very simple & advanced data scraping extension using [SelectorGadget](https://github.com/cantino/selectorgadget) to extract data from websites using point-and-click CSS Selectors with real-time extracted data preview and export data into JSON/CSV/TSV quickly.

## How to use

1. Go to website you want to extract and then launch the app.
2. Click on a webpage element that you would like to extract (it will turn green). Agenty will then generate best CSS selector for that element, and will highlight (yellow) everything that is matched by that selector as suggestion.
3. Now you can click on a highlighted element to remove it from the selector (red), or click on an un-highlighted element to add it to the extractor. Through this process of selection and rejection, Agenty will help you come up with the perfect CSS selector for your items need to be extracted.
4. Extract any number of fields with TEXT, HTML or ATTR (attributes) and instant output preview of extracted data.

## Development

- Angular JS - To build the sidebar - https://angularjs.org/
- Agenty API  - To create, update agents in customer account - https://www.agenty.com/docs/api
- Angular Loaders - To display loading icon https://github.com/alexjoffroy/angular-loaders
- SelectorGadget - To genreate CSS selectors - https://github.com/cantino/selectorgadget

## Chrome extension key

The `key.pem` can be found in any zipped folder under [release](https://github.com/Agenty/agenty-chrome-extension/releases)

## Source Control

Use [Atom open-source](https://atom.io/) software to build and source control
