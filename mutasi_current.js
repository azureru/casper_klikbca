// Get Current Balance

// how to run?
// casperjs --ignore-ssl-errors=true mutasi_current.js username password
// Will exit with code
//    0 success
//    422 bad param / user / password
//    500 error!

var DEBUG   = false;
var VERBOSE = false;

var casper = require('casper').create({
    verbose: VERBOSE,
    logLevel: (VERBOSE) ? "debug" : "error"
});
var util = require('utils');
var isLoggedIn = false;

// check for command `args`
if (casper.cli.args.length < 2) {
    console.log("[ERR] Username and password is required!");
    console.log("[ERR] Usage: casperjs klikbca.js username password");
    die(422);
}

// Basically do a clean exit (if logged in the attempt to logout first)
function die(optCode) {
    if (optCode == null || typeof optCode == "undefined") {
        optCode = 500;
    }

    if (isLoggedIn) {
        casper.then(function() {
            // try to logout first
            if (optCode !== 0) {
                console.log("[ERR] Forced logout..." + optCode);
            }
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
  console.error(msgStack.join('\n'));
  phantom.exit(500);
};
casper.on("remote.message", function(msg) {
    this.echo("Console: " + msg);
});
casper.on("remote.alert", function(msg) {
    this.echo("[ERR] " + msg);
});
casper.on("page.error", function(msg, trace) {
    this.echo("[ERR] " + msg);
});
casper.on("resource.error", function(resourceError) {
    if (resourceError.errorCode == 301) {
        return;
    }
    if (resourceError.errorCode == 5) {
        return;
    }
    this.echo("[ERR] " + JSON.stringify(resourceError, undefined, 4));
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
    console.log("[LOGIN] " + username);
});
casper.then(function() {
    if (DEBUG) {
        this.capture('bca-login.png');
    }
});

// Iterate Menu Link
casper.then(function() {
    // validate it first!
    if (this.exists('#Layer1')) {
        // if we still found a layer1 - we still stuck on the login form
        console.log("[ERR] Login Failed...");
        die(422);
    } else {
        isLoggedIn = true;
    }
});
casper.then(function() {
    var clickAccountInformation = casper.evaluate(function() {
        var menu        = document.getElementsByName("menu")[0];
        var menuContent = menu.contentWindow;
        if (typeof menuContent !== 'undefined' && menuContent != null) {
            var mutasiA = menuContent.document.getElementsByTagName("a")[4];
            mutasiA.click();
            return true;
        } else {
            return false;
        }
    });
    if (!clickAccountInformation) {
        die(500);
    }
});
casper.then(function() {
    if (DEBUG) {
        this.capture('bca-informasi-rekening.png');
    }
});


// Iterate Menu link
casper.then(function() {
    casper.evaluate(function() {
        var menu = document.getElementsByName("menu")[0];
        var menuContent = menu.contentWindow;
        if (typeof menuContent !== 'undefined' && menuContent != null) {
            var mutasiA = menuContent.document.getElementsByTagName("a")[1];
            mutasiA.click();
        }
    });
});
casper.then(function() {
    var balance = this.page.evaluate(function() {
        var atm = document.getElementsByName("atm")[0];
        var atmContent = atm.contentWindow;
        if (typeof atmContent !== 'undefined' && atmContent != null) {
            var tdBalance = atmContent.document.getElementsByTagName("td")[14];
            var value = tdBalance.innerText;
            return value;
        } else {
            return false;
        }
    });
    // remove commas and round the value
    balance = balance.replace(/[\,]/g,'');
    balance = Math.round(balance);
    if (balance !== false) {
        console.log("[RES] = "+balance);
    }
});

// logging out
casper.then(function() {
    die(0);
});

casper.run(function() {
    this.exit(0);
});