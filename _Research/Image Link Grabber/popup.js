var message;
var output;
var output_2;
var timeOutEvent = null;
var site = 'https://www.mediafreeware.com/image-link-grabber';
var btnActivate;
var inputKey;
var proElem;
function isEmptyOrSpaces(str) {
  return str === null || str.match(/^\s*$/) !== null;
}

window.onload = function() {

  proElem = document.getElementById('pro');
  btnActivate = document.getElementById('activate');
  inputKey = document.getElementById('apikey');
  btnActivate.addEventListener('click', function() {
    
    checkac();
  });


  chrome.storage.sync.set({ 
    'ordered': '',
    'unordered': '',
    }, function() {
  });

  new Clipboard('.button');
  message = document.querySelector('#message');
  output = document.querySelector('#output');
  output_2 = document.querySelector('#output_2');
  //console.log("The page has loaded!");
  

  chrome.runtime.sendMessage({ action: 'to-background' }, (response) => {
    timeOutEvent = setInterval(poll, 1000);
    return true;
  });


};

var current_list = '';

async function poll()
{
  message.innerText = '';
  var data = await chrome.storage.sync.get(['ordered', 'unordered', 'impdt', 'usage_count']);
  var usage_count = data.usage_count;
  var prof = chekdt(data.impdt);  
  if(!prof && usage_count > 10)
  {
    proElem.style.display = 'block';
    message.innerHTML = '<span class="error">Please activate your extension with an API Key.</span>';
    clearInterval(timeOutEvent);
    return;
  }



  if(current_list !== data.ordered)
  {
    current_list = data.ordered;
    output.value = data.ordered;
    output_2.value = data.unordered;  

    //console.log(usage_count);
    usage_count = usage_count + 1;
    chrome.storage.sync.set({ 'usage_count': usage_count}, async function() {});

    clearInterval(timeOutEvent);
  }
}


function chekdt(impdt) {
    if(impdt == "") return false;
    const today = new Date();
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1; // Months start at 0!
    let dd = today.getDate();
    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;
    const fmtdt = mm + '-' + dd + '-' + yyyy;
    const d1 = new Date(impdt);
    const d2 = new Date(fmtdt);
    const diff = Math.abs(d2 - d1);
    const diffD = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if(diffD < 0) {return false;} else {return true};
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkac()
{
    btnActivate.value = ('Activating');
    await sleep(500);

    var prokey = inputKey.value.trim();
    //console.log(prokey);
    if(prokey == "" || prokey.length < 20)
    {
      alert('Invalid key');

      btnActivate.value = ('Activate');
      return;
    }

  fetch(site + '/api.html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'prokey' : prokey,
      'appid' : chrome.runtime.id,
    },
    body: JSON.stringify({
      data: 'some data'
    })
  })
  .then(response => response.json())
  .then(result => {
    
    if(result.status && result.status==="ok" && result.prokey && result.impdt)
    {
        chrome.storage.sync.set({ 'apikey': result.prokey, 'impdt': result.impdt}, async function() 
          {
            await sleep(1000);
            btnActivate.value = ('Activated');
            await sleep(1000);
            btnActivate.value = ('Activate');

            var chk = chekdt(result.impdt);
            if(chk)
            {
              proElem.style.display = 'none';
              message.innerHTML = '<span class="success">Activated.</span>';
            }
        });
    }

    if(result.status && result.status==="expired")
    {
        chrome.storage.sync.set({ 
          'apikey': '',
          'impdt': '',

        }, async function() 
          {
            await sleep(1000);
            btnActivate.value = ('Expired');
            await sleep(1000);

            btnActivate.value = ('Activate');

            message.innerHTML = '<span class="error">Expired.</span>';
        });
    }

    if(result.status && result.status==="error")
    {
      alert('Failed, check key or try again.');
      btnActivate.value = ('Activate');
    }
  })
  .catch(error => {
  });
}