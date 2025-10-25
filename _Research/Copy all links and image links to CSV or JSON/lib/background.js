chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var data = '';
	//alert(request);
	if(request == 'getAllLinks') {
		var data = [];
		var links = document.links;
		for(var i=0; i<links.length; i++) {
			var linkText = links[i].innerText.trim();
			var linkValue = links[i].href;
			if(linkValue.indexOf('javascript:') == -1) {
				var found = false;

				for (var j = data.length - 1; j >= 0; j--) {
					if(data[j].link == linkValue) {
						if(data[j].texts.indexOf(linkText) < 0) data[j].texts.push(linkText);
						data[j].count++;
						found = true;
						break;
					}
				};
				if(found) continue;
				data.push({
					link: linkValue,
					count: 1,
					text: linkText,
					texts: [linkText]
				});
			}
		}
		if(data.length > 0) data.sort(function(a, b){return (b.count) - (a.count)});
		sendResponse(JSON.stringify(data));
	} else if(request == 'getAllImages') {
		var data = [];

		function getallBgimages(){
			var url, B= [], A= document.getElementsByTagName('*');
			A= B.slice.call(A, 0, A.length);
			while(A.length){
				url = document.deepCssScan(A.shift(), 'background-image');
				if(url) url=/url\(['"]?([^")]+)/.exec(url) || [];
				url= url[1];
				if(!url) continue;
				//console.log(url);
				//console.log(B);
				if(!!url && !!B && !!B.indexOf && B.indexOf(url)=== -1) {
					if(!!url && url.indexOf("//") === 0) url = location.protocol + url;
					if(!!url && url.indexOf("data") === 0) continue;
					B[B.length] = {src: url};
				}
			}
			return B;
		}

		function getallNGSRCimages(){
			var url, B= [], A= document.getElementsByTagName('*');
			A= B.slice.call(A, 0, A.length);
			while(A.length){
				url = document.deepCssScan(A.shift(), 'ng-src');
				if(url) url=/url\(['"]?([^")]+)/.exec(url) || [];
				url= url[1];
				if(!url) continue;
				//console.log(url);
				//console.log(B);
				if(!!url && !!B && !!B.indexOf && B.indexOf(url)=== -1) {
					if(!!url && url.indexOf("//") === 0) url = location.protocol + url;
					if(!!url && url.indexOf("data") === 0) continue;
					B[B.length] = {src: url};
				}
			}
			return B;
		}

		document.deepCssScan = function(who, css){
			if(!who || !who.style) return '';
				var sty= css.replace(/\-([a-z])/g, function(a, b){
				return b.toUpperCase();
			});
			if(who.currentStyle){
				return who.style[sty] || who.currentStyle[sty] || '';
			}
			var dv= document.defaultView || window;
			return who.style[sty] || dv.getComputedStyle(who,"").getPropertyValue(css) || '';
		}

		var images = getallBgimages();
		var images2 = getallNGSRCimages();
		var images3 = document.images;
		for (var i = images2.length - 1; i >= 0; i--) images.push(images2[i]);
		for (var i = images3.length - 1; i >= 0; i--) images.push(images3[i]);

		//console.log(images);
		for(var i=0; i<images.length; i++) {
			var linkText = images[i].alt || images[i].title || "";
			var linkValue = images[i].src || "";
			var linkHeight = images[i].height || "";
			var linkWidth = images[i].width || "";
			//console.log(images[i].src);
			//console.log(images[i].alt);
			//console.log(images[i].height);
			//console.log(images[i].width);
			if(linkValue.indexOf('javascript:') == -1) {
				var found = false;

				for (var j = data.length - 1; j >= 0; j--) {
					if(data[j].link == linkValue) {
						if(data[j].titles.indexOf(linkText) < 0) data[j].titles.push(linkText);
						if(data[j].height < linkHeight) data[j].height = linkHeight;
						if(data[j].width < linkWidth) data[j].height = linkWidth;
						data[j].count++;
						found = true;
						break;
					}
				};
				if(found) continue;
				data.push({
					link: linkValue,
					count: 1,
					height: linkHeight,
					width: linkWidth,
					title: linkText,
					titles: [linkText]
				});
			}
		}
		if(data.length > 0) data.sort(function(a, b){return (b.height*b.width) - (a.height*a.width)});
		sendResponse(JSON.stringify(data));
	}
});