/*** CONSTANTS ***/
var ELEMENT_NODE_TYPE = 1;
var TEXT_NODE_TYPE = 3;
var UNEXPANDABLE = /(script|style|svg|audio|canvas|figure|video|select|input|textarea)/i;
var HIGHLIGHT_TAG = 'highlight-tag';
var HIGHLIGHT_CLASS = 'highlighted';
var HIGHLIGHT_CLASS_CONTINUE = 'contiue';
var SELECTED_CLASS = 'selected';
var DEFAULT_MAX_RESULTS = 500;
var DEFAULT_HIGHLIGHT_COLOR = '#ffff00';
var DEFAULT_SELECTED_COLOR = '#ff9900';
var DEFAULT_TEXT_COLOR = '#000000';
var DEFAULT_CASE_INSENSITIVE = true;
/*** CONSTANTS ***/

/*** VARIABLES ***/
var searchInfo;
/*** VARIABLES ***/

/*** LIBRARY FUNCTIONS ***/
Element.prototype.documentOffsetTop = function () {
  return this.offsetTop + (this.offsetParent ? this.offsetParent.documentOffsetTop() : 0);
};
Element.prototype.visible = function () {
  return (!window.getComputedStyle(this) || window.getComputedStyle(this).getPropertyValue('display') == '' ||
    window.getComputedStyle(this).getPropertyValue('display') != 'none')
}
/*** LIBRARY FUNCTIONS ***/


/*** FUNCTIONS ***/
/* Initialize search information for this tab */
function initSearchInfo(pattern) {
  var pattern = typeof pattern !== 'undefined' ? pattern : '';
  searchInfo = {
    regexString: pattern,
    selectedIndex: 0,
    highlightedNodes: [],
    length: 0
  }
}

/* Send message with search information for this tab */
function returnSearchInfo(cause) {
  chrome.runtime.sendMessage({
    'message': 'returnSearchInfo',
    'regexString': searchInfo.regexString,
    'currentSelection': searchInfo.selectedIndex,
    'numResults': searchInfo.length,
    'cause': cause
  });
}

/* Check if the given node is a text node */
function isTextNode(node) {
  return node && node.nodeType === TEXT_NODE_TYPE;
}

/* Check if the given node is an expandable node that will yield text nodes */
function isExpandable(node) {
  return node && node.nodeType === ELEMENT_NODE_TYPE && node.childNodes &&
    !UNEXPANDABLE.test(node.tagName) && node.visible();
}

/* Highlight all text that matches regex */
function highlight(regex, highlightColor, selectedColor, textColor, maxResults) {
  function highlightRecursive(node, force) {

    if (searchInfo.length >= maxResults) {
      return;
    }
    if (isTextNode(node)) {
      var index = node.data.search(regex);
      if (index >= 0 && node.data.length > 0) {
        var matchedText = node.data.match(regex)[0];
        var matchedTextNode = node.splitText(index);
        matchedTextNode.splitText(matchedText.length);
        var spanNode = document.createElement(HIGHLIGHT_TAG);
        spanNode.className = HIGHLIGHT_CLASS;
        spanNode.style.backgroundColor = highlightColor;
        spanNode.style.color = textColor;
        spanNode.appendChild(matchedTextNode.cloneNode(true));
        matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
        searchInfo.highlightedNodes.push(spanNode);
        searchInfo.length += 1;
        return 1;
      }
    }
    else if (force) {
      var newText = "";
      var children = node.childNodes;
      for (var i = 0; i < children.length; ++i) {
        if (children[i].nodeType === TEXT_NODE_TYPE) {
          newText += children[i].data;
        }
        else if (children[i].nodeName === "A") {
          newText += children[i].childNodes[0].data;
        }
      }
      var index = newText.search(regex);

      var newRegex = new RegExp(regex.source, regex.ignoreCase ? 'ig' : 'g');
      if (index >= 0 && newText.length > 0) {
        var indexArray = [];
        while ((array = newRegex.exec(newText)) !== null) {
          indexArray.push(array.index);
        }
        // var indexArray = newRegex.exec(newText);
        var matchedTextArray = newText.match(newRegex);
        var indexNum = 0;
        // index = newText.search(regex);
        var matchedText = newText.match(regex)[0];
        var childrenTextLength = [];
        var childrenTextTotalLength = 0;
        var startFlag = false;
        var endLength = matchedText.length;
        var endFlag = false;
        for (var i = 0; i < children.length; ++i) {
          if (endFlag) {
            // break;
            indexNum++;
            if (indexArray.length > indexNum) {
              matchedText = matchedTextArray[indexNum];
              index = indexArray[indexNum];
              endLength = matchedText.length;
              childrenTextTotalLength = 0;
              endFlag = false;
              childrenTextLength = [];
              for (var j = 0; j < children.length - 1; ++j) {
                if(j==i){
                  break;
                }
                if (children[j].nodeType === TEXT_NODE_TYPE) {
                  childrenTextTotalLength += children[j].textContent.length;
                  childrenTextLength.push(childrenTextTotalLength)
                }
                else if (children[j].nodeName === "HIGHLIGHT-TAG") {
                  childrenTextTotalLength += children[j].innerText.length;
                  childrenTextLength.push(childrenTextTotalLength)
                }
              }
            }
            else {
              break;
            }
          }
          if (children[i].nodeType === TEXT_NODE_TYPE) {
            childrenTextTotalLength += children[i].textContent.length;
            childrenTextLength.push(childrenTextTotalLength)
            if (index <= childrenTextTotalLength && !startFlag) {
              startFlag = true;
              var newIndex = index;
              if (childrenTextLength.length > 1) {
                newIndex = index - childrenTextLength[childrenTextLength.length - 2];
              }
              var matchedTextNode = children[i].splitText(newIndex);
              if (index + matchedText.length < childrenTextTotalLength) {
                matchedTextNode.splitText(matchedText.length);
                startFlag = false;
                searchInfo.length += 1;
                endFlag = true;
              }
              else {
                matchedTextNode.splitText(childrenTextTotalLength - index);
                endLength = endLength - (childrenTextTotalLength - index);
              }
              var spanNode = document.createElement(HIGHLIGHT_TAG);
              spanNode.className = HIGHLIGHT_CLASS;
              spanNode.style.backgroundColor = highlightColor;
              spanNode.style.color = textColor;
              spanNode.appendChild(matchedTextNode.cloneNode(true));
              matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
              searchInfo.highlightedNodes.push(spanNode);
              // searchInfo.length += 1;
            }
            else if (startFlag) {
              if (index + matchedText.length <= childrenTextTotalLength) {

                var matchedTextNode = children[i].splitText(0);
                matchedTextNode.splitText(endLength);
                startFlag = false;
                var spanNode = document.createElement(HIGHLIGHT_TAG);
                spanNode.className = HIGHLIGHT_CLASS + ' ' + HIGHLIGHT_CLASS_CONTINUE;
                spanNode.style.backgroundColor = highlightColor;
                spanNode.style.color = textColor;
                spanNode.appendChild(matchedTextNode.cloneNode(true));
                matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
                searchInfo.highlightedNodes.push(spanNode);
                searchInfo.length += 1;
                endFlag = true;
              }
              else {
                if (childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2] == 0) {
                  continue;
                }
                endLength = endLength - (childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2])
                var matchedTextNode = children[i].splitText(0);
                matchedTextNode.splitText(childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2])
                var spanNode = document.createElement(HIGHLIGHT_TAG);
                spanNode.className = HIGHLIGHT_CLASS + ' ' + HIGHLIGHT_CLASS_CONTINUE;
                spanNode.style.backgroundColor = highlightColor;
                spanNode.style.color = textColor;
                spanNode.appendChild(matchedTextNode.cloneNode(true));
                matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
                searchInfo.highlightedNodes.push(spanNode);
                // searchInfo.length += 1;
              }
            }
            else {
              --i;
            }
            ++i;
          }
          else if (children[i].nodeName === "A") {
            childrenTextTotalLength += children[i].innerText.length;
            childrenTextLength.push(childrenTextTotalLength)

            if (index <= childrenTextTotalLength && !startFlag) {
              startFlag = true;
              var newIndex = index;
              if (childrenTextLength.length > 1) {
                newIndex = index - childrenTextLength[childrenTextLength.length - 2];
              }
              var matchedTextNode = children[i].childNodes[0].splitText(newIndex);
              if (index + matchedText.length < childrenTextTotalLength) {
                matchedTextNode.splitText(matchedText.length);
                startFlag = false;
                searchInfo.length += 1;
                endFlag = true;
              }
              else {
                matchedTextNode.splitText(childrenTextTotalLength - index);
                endLength = endLength - (childrenTextTotalLength - index);
              }
              var spanNode = document.createElement(HIGHLIGHT_TAG);
              spanNode.className = HIGHLIGHT_CLASS;
              spanNode.style.backgroundColor = highlightColor;
              spanNode.style.color = textColor;
              spanNode.appendChild(matchedTextNode.cloneNode(true));
              matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
              searchInfo.highlightedNodes.push(spanNode);
              // searchInfo.length += 1;
            }
            else if (startFlag) {
              if (index + matchedText.length <= childrenTextTotalLength) {
                var matchedTextNode = children[i].childNodes[0].splitText(0);
                matchedTextNode.splitText(endLength);
                startFlag = false;
                var spanNode = document.createElement(HIGHLIGHT_TAG);
                spanNode.className = HIGHLIGHT_CLASS + ' ' + HIGHLIGHT_CLASS_CONTINUE;
                spanNode.style.backgroundColor = highlightColor;
                spanNode.style.color = textColor;
                spanNode.appendChild(matchedTextNode.cloneNode(true));
                matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
                searchInfo.highlightedNodes.push(spanNode);
                searchInfo.length += 1;
                endFlag = true;
              }
              else {
                if (childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2] == 0) {
                  continue;
                }
                endLength = endLength - (childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2])
                var matchedTextNode = children[i].childNodes[0].splitText(0);
                matchedTextNode.splitText(childrenTextTotalLength - childrenTextLength[childrenTextLength.length - 2])
                var spanNode = document.createElement(HIGHLIGHT_TAG);
                spanNode.className = HIGHLIGHT_CLASS + ' ' + HIGHLIGHT_CLASS_CONTINUE;
                spanNode.style.backgroundColor = highlightColor;
                spanNode.style.color = textColor;
                spanNode.appendChild(matchedTextNode.cloneNode(true));
                matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);

                searchInfo.highlightedNodes.push(spanNode);
                // searchInfo.length += 1;
              }
            }
          }
        }
        return 1;
      }
    }
    else if (isExpandable(node)) {
      var children = node.childNodes;
      // if (node.attributes["id"] && node.attributes["id"].value == "mytest") {
      //   debugger;
      // }

      var onlyContainA = true;
      if (children.length > 1) {
        for (var i = 0; i < children.length; ++i) {
          var child = children[i];
          if (!(child.nodeName === "A" || child.nodeType === TEXT_NODE_TYPE)) {
            onlyContainA = false;
            break;
          }
        }
      }
      else {
        // onlyContainA = false;
      }
      if (onlyContainA) {
        highlightRecursive(node, onlyContainA);
      }
      else {
        for (var i = 0; i < children.length; ++i) {
          var child = children[i];
          i += highlightRecursive(child);
        }
      }

    }
    return 0;
  }
  highlightRecursive(document.getElementsByTagName('body')[0]);
};

/* Remove all highlights from page */
function removeHighlight() {
  while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + HIGHLIGHT_CLASS)) {
    if (node.previousSibling) {
      node.previousSibling.textContent = node.previousSibling.textContent + node.innerHTML + (node.nextSibling ? node.nextSibling.textContent : "");
      node.nextSibling.remove();
      node.remove();
    }
    else if (node.nextSibling) {
      node.nextSibling.textContent = node.innerHTML + node.nextSibling.textContent;
      node.remove()
    }
    else {
      node.outerHTML = node.innerHTML;
    }
    // node.outerHTML = node.innerHTML;
  }
  while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + SELECTED_CLASS)) {
    if (node.previousSibling) {
      node.previousSibling.textContent = node.previousSibling.textContent + node.innerHTML + (node.nextSibling ? node.nextSibling.textContent : "");
      node.nextSibling.remove();
      node.remove();
    }
    else if (node.nextSibling) {
      node.nextSibling.textContent = node.innerHTML + node.nextSibling.textContent;
      node.remove()
    }
    else {
      node.outerHTML = node.innerHTML;
    }
    // node.outerHTML = node.innerHTML;
  }
};

/* Scroll page to given element */
function scrollToElement(element) {
  element.scrollIntoView();
  var top = element.documentOffsetTop() - (window.innerHeight / 2);
  window.scrollTo(0, Math.max(top, window.pageYOffset - (window.innerHeight / 2)));
}

/* Select first regex match on page */
function selectFirstNode(selectedColor) {
  var length = searchInfo.length;
  if (length > 0) {
    searchInfo.highlightedNodes[0].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[0].style.backgroundColor = selectedColor;
    parentNode = searchInfo.highlightedNodes[0].parentNode;
    if (parentNode.nodeType === 1) {
      parentNode.focus();
    } else if (parentNode.parentNode.nodeType == 1) {
      parentNode.parentNode.focus();
    }
    scrollToElement(searchInfo.highlightedNodes[0]);
  }
}

/* Helper for selecting a regex matched element */
function selectNode(highlightedColor, selectedColor, getNext) {
  var length = searchInfo.length;
  if (length > 0) {
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = HIGHLIGHT_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = highlightedColor;
    if (getNext) {
      if (searchInfo.selectedIndex === length - 1) {
        searchInfo.selectedIndex = 0;
      } else {
        searchInfo.selectedIndex += 1;
      }
    } else {
      if (searchInfo.selectedIndex === 0) {
        searchInfo.selectedIndex = length - 1;
      } else {
        searchInfo.selectedIndex -= 1;
      }
    }
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = selectedColor;
    parentNode = searchInfo.highlightedNodes[searchInfo.selectedIndex].parentNode;
    if (parentNode.nodeType === 1) {
      parentNode.focus();
    } else if (parentNode.parentNode.nodeType == 1) {
      parentNode.parentNode.focus();
    }
    returnSearchInfo('selectNode');
    scrollToElement(searchInfo.highlightedNodes[searchInfo.selectedIndex]);
  }
}
/* Forward cycle through regex matched elements */
function selectNextNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, true);
}

/* Backward cycle through regex matched elements */
function selectPrevNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, false);
}

/* Validate that a given pattern string is a valid regex */
function validateRegex(pattern) {
  try {
    var regex = new RegExp(pattern);
    return regex;
  } catch (e) {
    return false;
  }
}

/* Find and highlight regex matches in web page from a given regex string or pattern */
function search(regexString, configurationChanged) {
  var regex = validateRegex(regexString);
  if (regex && regexString != '' && (configurationChanged || regexString !== searchInfo.regexString)) { // new valid regex string
    removeHighlight();
    chrome.storage.local.get({
      'highlightColor': DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor': DEFAULT_SELECTED_COLOR,
      'textColor': DEFAULT_TEXT_COLOR,
      'maxResults': DEFAULT_MAX_RESULTS,
      'caseInsensitive': DEFAULT_CASE_INSENSITIVE
    },
      function (result) {
        initSearchInfo(regexString);
        if (result.caseInsensitive) {
          regex = new RegExp(regexString, 'i');
        }
        highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
        selectFirstNode(result.selectedColor);
        returnSearchInfo('search');
      }
    );
  } else if (regex && regexString != '' && regexString === searchInfo.regexString) { // elements are already highlighted
    chrome.storage.local.get({
      'highlightColor': DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor': DEFAULT_SELECTED_COLOR
    },
      function (result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  } else { // blank string or invalid regex
    removeHighlight();
    initSearchInfo(regexString);
    returnSearchInfo('search');
  }
}
/*** FUNCTIONS ***/

/*** LISTENERS ***/
/* Received search message, find regex matches */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if ('search' == request.message) {
    search(request.regexString, request.configurationChanged);
  }
  /* Received selectNextNode message, select next regex match */
  else if ('selectNextNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor': DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor': DEFAULT_SELECTED_COLOR
    },
      function (result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  }
  /* Received selectPrevNode message, select previous regex match */
  else if ('selectPrevNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor': DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor': DEFAULT_SELECTED_COLOR
    },
      function (result) {
        selectPrevNode(result.highlightColor, result.selectedColor);
      }
    );
  }
  else if ('copyToClipboard' == request.message) {
    // var clipboardHelper = document.createElement('textarea');
    try {
      var text = searchInfo.highlightedNodes.map(function (n) {
        if (searchInfo.highlightedNodes.indexOf(n) == 0 || n.className.indexOf("contiue") > -1) {
          return n.innerText;
        }
        else {
          return '\n' + n.innerText;
        }
      }).join('');
      navigator.clipboard.writeText(text).then(() => { });
      // clipboardHelper.appendChild(document.createTextNode(text));
      // document.body.appendChild(clipboardHelper);
      // clipboardHelper.select();
      // document.execCommand('copy');
    } finally {
      // document.body.removeChild(clipboardHelper);
    }
  }
  /* Received getSearchInfo message, return search information for this tab */
  else if ('getSearchInfo' == request.message) {
    sendResponse({ message: "I'm alive!" });
    returnSearchInfo('getSearchInfo');
  }
});
/*** LISTENERS ***/


/*** INIT ***/
initSearchInfo();
/*** INIT ***/
