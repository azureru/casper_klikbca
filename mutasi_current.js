// Get Current Balance
// casperjs mutasi_current.js username password
// Will exit with code:
//    0 success
//    422 bad param / user / password
//    500 error!

var DEBUG   = false;
var VERBOSE = false;

var casper = require('casper').create({
    verbose  : VERBOSE,
    logLevel : (VERBOSE) ? "debug" : "error"
});
var util       = require('utils');
var isLoggedIn = false;

// check for command `args`
if (casper.cli.args.length < 2) {
    die(422, 'Username and Password is required');
}

// Basically do a clean exit (if logged in the attempt to logout first)
function die(optCode, msg) {
    if (optCode === null || typeof optCode == "undefined") {
        optCode = 500;
    }
    if (typeof msg !== "undefined") {
        console.log("[ERR] " + msg);
    }

    if (isLoggedIn) {
        casper.then(function() {
            // try to logout first
            if (optCode !== 0) {
                console.log("[ERR] Forced logout..." + optCode);
            }
            // random wait for 1-3 seconds
            var rand = (Math.random() * 2000) + 1000;
            casper.wait(rand, function() {
                var location = casper.evaluate(function() {
                    window.location.href = '/authentication.do?value(actions)=logout';
                });
            });
        });
    }
    casper.then(function() {
        casper.exit(optCode);
    });
}

// error handlers
phantom.onError = function(msg, trace) {
  var msgStack = ['[ERR] ' + msg];
  if (trace && trace.length) {
    msgStack.push('[Stack]: ');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
    });
  }
  die(500, msgStack.join('\n'));
};
casper.on("remote.message", function(msg) {
    if (VERBOSE) {
        this.echo("Console: " + msg);
    }
});
casper.on("remote.alert", function(msg) {
    // if there's alert - we consider it as blocking
    // it's probably a validation error
    die(422, msg);
});
casper.on("page.error", function(msg, trace) {
    die(500, msg);
});
casper.on("resource.error", function(resourceError) {
    if (resourceError.errorCode == 301 || resourceError.errorCode == 203 || resourceError.errorCode == 5) {
        return;
    }
    die(500, JSON.stringify(resourceError, undefined, 4));
});

// parse the username and password from param
var username = casper.cli.args[0];
var password = casper.cli.args[1];

// Logging in
casper.start('https://ibank.klikbca.com', function() {
    var loggingIn = casper.evaluate(function(username, password) {
        document.getElementById('user_id').value = username;
        document.getElementById('pswd').value    = password;
        document.querySelector("input[name='value(Submit)']").click();
    }, {username : username, password: password});
    if (VERBOSE) {
        console.log("[LOGIN] " + username);
    }
});

// Iterate Menu Link
casper.then(function() {
    // validate it first!
    if (this.exists('#Layer1')) {
        // if we still found a layer1 - we still stuck on the login form
        die(422, 'Login failed...' + username);
    } else {
        isLoggedIn = true;
    }
});
casper.then(function() {
    var clickAccountInformation = casper.evaluate(function() {
        var menu        = document.getElementsByName("menu")[0];
        var menuContent = menu.contentWindow;
        if (typeof menuContent !== 'undefined' && menuContent !== null) {
            var mutasiA = menuContent.document.getElementsByTagName("a")[4];
            mutasiA.click();
            return true;
        } else {
            return false;
        }
    });
    if (clickAccountInformation === false) {
        return die(500, 'Evaluate error - probably a layout change?');
    }
});

// Iterate Menu link
casper.then(function() {
    var getMenu = casper.evaluate(function() {
        var menu = document.getElementsByName("menu")[0];
        var menuContent = menu.contentWindow;
        if (typeof menuContent !== 'undefined' && menuContent !== null) {
            var mutasiA = menuContent.document.getElementsByTagName("a")[1];
            mutasiA.click();
            return true;
        }
        return false;
    });
    if (getMenu === false) {
        return die(500, 'Evaluate error - probably a layout change?');
    }
});

// get balance
casper.then(function() {
    var balance = this.page.evaluate(function() {
        var atm = document.getElementsByName("atm")[0];
        var atmContent = atm.contentWindow;
        if (typeof atmContent !== 'undefined' && atmContent !== null) {
            var tdBalance = atmContent.document.getElementsByTagName("td")[14];
            var value = tdBalance.innerText;
            return value;
        } else {
            return false;
        }
    });
    if (balance === false) {
        return die(500, 'Evaluate error - probably a layout change?');
    }

    // remove commas and round the value
    balance = balance.replace(/[\,]/g,'');
    balance = Math.round(balance);
    if (balance !== false) {
        console.log(balance);
    }
});

// logging out
casper.then(function() {
    die(0);
});

casper.run(function() {
    this.exit(0);
});
