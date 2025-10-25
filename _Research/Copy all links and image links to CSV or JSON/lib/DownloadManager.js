var DownloadManager = React.createFactory(React.createClass({
	getInitialState:function(){
		var layout = "horizontal"
		var animations = true;
		var compact = false;

		return {
			layout:layout,
			animations:true,
			compact:false,
			transitionRunning: false,
			downloadData:"",
			downloadFilename:"",
			format:"csv",
			height:400,
			blocked: false,
			url:"",
			topText: "",
			bottomText: "",
			downloadActive:false
		}
	},
	shouldComponentUpdate: function(nextProps, nextState) {
		//console.log("should update?", nextProps, nextState);
		return true;
	},
	hoverHandler(tab) {
		console.log(this.refs.topbox);
		console.log(this.refs.topbox.className);
		this.refs.topbox.className = "";
		this.forceUpdate();
		this.setState({ topText : tab.title });
		this.setState({ bottomText : tab.url });

		this.refs.topbox.className = "animated";
		this.forceUpdate();
	},
	hoverIcon(e) {
		var text = e.target.title || " ";
		var bottom = " ";
		if(text.indexOf("\n") > -1) {
			var a = text.split("\n");
			text = a[0];
			bottom = a[1];
		}
		this.setState({ topText : text });
		this.setState({ bottomText : bottom });
		this.forceUpdate();
	},
	render:function(){
		var hiddenCount = this.state.hiddenCount || 0;
		var tabCount = this.state.tabCount || 0;
		return React.DOM.div({id:"root",className:(this.state.compact?"compact":"") + " " + (this.state.animations?"animations":"no-animations"),onKeyDown:this.checkKey,ref:"root",tabIndex:0},
			React.DOM.div({className:"window blocked " + (this.state.blocked?"":"hidden")},
				React.DOM.h1({}, "Ooops"),
				React.DOM.h3({}, "You can use this extension everywhere, except the Chrome Webstore."),
			),
			React.DOM.div({className:"window-container " + this.state.layout + " " + (this.state.blocked?"hidden":"") + " " + (this.state.downloadActive?"hidden":""),ref:"windowcontainer",tabIndex:2},
				React.DOM.div({className:"icon windowaction window history", tabIndex:"1",onMouseEnter:this.hoverIcon, onClick:this.downloadLinksCSV,ref:"hiscsv", title: "Download all links from this page in .csv format"},
					React.DOM.img({src:"images/sort.png", className:"right"}),
					"Download all ",
					React.DOM.strong({}, "links"),
					" from this page in .csv format ",
					React.DOM.br(),
					"( for Excel )",
					React.DOM.img({src:"images/csv.png", className:"right"})),
				React.DOM.div({className:"icon windowaction window history", tabIndex:"2",onMouseEnter:this.hoverIcon, onClick:this.downloadLinksJSON,ref:"hisjson", title: "Download all links from this page in JSON format"},
					React.DOM.img({src:"images/sort.png", className:"right"}),
					"Download all ",
					React.DOM.strong({}, "links"),
					" in JSON format ",
					React.DOM.br(),
					"( for developers )",
					React.DOM.img({src:"images/json.png", className:"right"})),
				React.DOM.div({className:"icon windowaction window downloads", tabIndex:"3",onMouseEnter:this.hoverIcon, onClick:this.downloadImagesCSV,ref:"dlcsv", title: "Download all image links from this page in .csv format"},
					React.DOM.img({src:"images/picture.png", className:"right"}),
					"Download all ",
					React.DOM.strong({}, "image links"),
					" in .csv format ",
					React.DOM.br(),
					"( for Excel )",
					React.DOM.img({src:"images/csv.png", className:"right"})),
				React.DOM.div({className:"icon windowaction window downloads", tabIndex:"4",onMouseEnter:this.hoverIcon, onClick:this.downloadImagesJSON,ref:"dljson", title: "Download all image links from this page in JSON format"},
					React.DOM.img({src:"images/picture.png", className:"right"}),
					"Download all ",
					React.DOM.strong({}, "image links"),
					" in JSON format ",
					React.DOM.br(),
					"( for developers )",
					React.DOM.img({src:"images/json.png", className:"right"})),
			),
			React.DOM.div({className:"options-container " + (this.state.blocked?" ":" hidden") + (this.state.downloadActive?" ":" hidden"),ref:"options-container"},
				React.DOM.div({className:"icon windowaction window history",onMouseEnter:this.hoverIcon,ref:"downloading", title: "Your download is starting..."},
					"Your Download is starting..."
				),
			),
			React.DOM.div({className:"window top " + (this.state.blocked?"hidden":""),ref:"tophover"},
				React.DOM.input({type:"text",disabled:true,className:"tabtitle",ref:"topbox",placeholder:"Save all links and image links from this page to a file", value:this.state.topText }),
				// React.DOM.input({type:"text",disabled:true,className:"taburl hidden",ref:"topboxurl",placeholder:this.getTip(), value:this.state.bottomText}),
			),
			React.DOM.div({className:"window placeholder"})
		)
	},
	componentDidMount:function(){
		chrome.windows.getCurrent(function(w) {
			chrome.tabs.getSelected(w.id, function(t) {
				if(t.url.indexOf("chrome.google.com/webstore") > -1) {
					this.state.blocked = true;
					this.forceUpdate();
				}
			}.bind(this));
		}.bind(this));
		this.refs.root.focus();
	},

	downloadLinksCSV:function(e){
		this.state.format = "csv";
		this.state.downloadFilename = "links";
		this.state.downloadActive = true;
		this.forceUpdate();
		this.linksDownload();
	},
	downloadLinksJSON:function(e){
		this.state.format = "json";
		this.state.downloadFilename = "links";
		this.state.downloadActive = true;
		this.forceUpdate();
		this.linksDownload();
	},
	downloadImagesCSV:function(e){
		this.state.format = "csv";
		this.state.downloadFilename = "images";
		this.state.downloadActive = true;
		this.forceUpdate();
		this.imagesDownload();
	},
	downloadImagesJSON:function(e){
		this.state.format = "json";
		this.state.downloadFilename = "images";
		this.state.downloadActive = true;
		this.forceUpdate();
		this.imagesDownload();
	},
	onMenuSelected: function(tab, id) {
		id = "images";
		if(id == 'images') {
			console.log("Send message");
			chrome.tabs.sendMessage(tab.id, 'getAllImages', this.sendRequestCallbackHandler);
		} else if(id == 'links') {
			console.log("Send message");
			chrome.tabs.sendMessage(tab.id, 'getAllLinks', this.sendRequestCallbackHandler);
		} else if(id == 'copytextselection') {
			console.log("Send message");
			chrome.tabs.sendMessage(tab.id, 'getTextLinksSelection', this.sendRequestCallbackHandler);
		}
	},
	sendRequestCallbackHandler: function(response) {
		console.log("response");
		var data = JSON.parse(response);
		console.log(response);
		console.log(data);
		// chrome.extension.sendMessage({
		// 	command: 'setClipboard',
		// 	data: data
		// });
		this.downloadFile("links.json", JSON.stringify(data, null, 2));
		//();
	},
	downloadFile: function(filename, downloadData){
		//var type = "application/octet-stream";
		//if(this.state.format == "csv") {
		//	type = "text/csv"
		//}else if(this.state.format == "json") {
			var type = "application/json";
		//}
		var blob = new Blob([downloadData], {
			type: type
		});
		var url = URL.createObjectURL(blob);

		chrome.downloads.download({
			url: url,
			headers: [{
				"name": "type",
				"value": type
			}],
			filename: filename
		}, function() {
			window.close();
		});
	},
	convertUTCDateToLocalDate: function(date) {
		var newDate = new Date(date.getTime()+date.getTimezoneOffset()*60*1000);

		var offset = date.getTimezoneOffset() / 60;
		var hours = date.getHours();

		newDate.setHours(hours - offset);

		return newDate;
	},
	linksDownload:function(){
		chrome.tabs.executeScript(null, { "file": "lib/background.js" }, function () {
			chrome.windows.getCurrent(function(w) {
				chrome.tabs.getSelected(w.id, function(t) {
					this.state.url = t.url;
					chrome.tabs.sendMessage(t.id, 'getAllLinks', this.searchReceived);
				}.bind(this));
			}.bind(this));
		}.bind(this));
	},
	imagesDownload:function(){
		chrome.tabs.executeScript(null, { "file": "lib/background.js" }, function () {
			chrome.windows.getCurrent(function(w) {
				chrome.tabs.getSelected(w.id, function(t) {
					this.state.url = t.url;
					chrome.tabs.sendMessage(t.id, 'getAllImages', this.searchReceived);
				}.bind(this));
			}.bind(this));
		}.bind(this));
	},
	slugify: function(text)
	{
		return text.trim().toString().toLowerCase()
			.replace(/\s+/g, '-')           // Replace spaces with -
			.replace(/[^\w\-]+/g, '-')       // Remove all non-word chars
			.replace(/\-\-+/g, '-')         // Replace multiple - with single -
			.replace(/^-+/, '')             // Trim - from start of text
			.replace(/-+$/, '');            // Trim - from end of text
	},
	searchReceived:function(searchResults){
		console.log("this search reveide");
		var text, filename;
		searchResults = JSON.parse(searchResults);

		this.state.downloadData = "";

		if (this.state.format === "csv") {

			var keys = Object.keys(searchResults[0]);
			keys.sort();
			this.state.downloadData += keys.join(",");

			var row, time, value;
			for (var i = 0; i < searchResults.length; i++) {
				row = "";
				for (var j = 0; j < keys.length; j++) {
					if(!searchResults[i][keys[j]]) {
						value = "";
					}else{
						value = searchResults[i][keys[j]].toString();
					}
					value = value.replace(/"/g, '""');
					if (value.search(/("|,|\n)/g) >= 0) value = '"' + value + '"';
					row += value;
					if (j !== keys.length - 1) row += ",";
				}
				this.state.downloadData += "\n" + row;
			}
		} else {
			this.state.downloadData = JSON.stringify(searchResults, null, 2);
		}

		const isoDate = new Date().toISOString().substr(0, 10);
		this.downloadFile(this.state.downloadFilename + "-" + this.slugify(this.state.url) + "-" + isoDate + "." + this.state.format);
	},
	downloadFile:function(filename){
		var type = "application/octet-stream";
		if(this.state.format == "csv") {
			type = "text/csv"
		}else if(this.state.format == "json") {
			type = "application/json";
		}
		var blob = new Blob([this.state.downloadData], {
			type: type
		});
		var url = URL.createObjectURL(blob);

		chrome.downloads.download({
			url: url,
			headers: [{
				"name": "type",
				"value": type
			}],
			filename: filename
		}, this.downloadDone);
	},
	downloadDone: function(downloadId) {
		console.log("dl id", downloadId);
		this.state.downloadActive = false;
		this.forceUpdate();
		window.close();
	},
	getTip:function(){
		return "";
	}
}));
