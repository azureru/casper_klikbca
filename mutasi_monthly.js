// Download for BCA last month mutasi detail

// how to run?
// casperjs --ignore-ssl-errors=true mutasi_monthly.js username password
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
    casper.exit(422);
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
    if (resourceError.errorCode == 203) {
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

// get date of last month
var date     = new Date();
var firstDay = new Date(date.getFullYear(), date.getMonth() - 1 , 1);
var lastDay  = new Date(date.getFullYear(), date.getMonth(), 0);

// construct a padded DateMonth
var whatMonth = String("0" + lastDay.getMonth()+1).slice(-2);
var whatYear  = lastDay.getFullYear();
var firstDayString = String("0" + firstDay.getDate()).slice(-2) + whatMonth;
var lastDayString  = String("0" + lastDay.getDate()).slice(-2) + whatMonth;
console.log("[MONTH] "+firstDayString+" - "+lastDayString);

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
        if (typeof menuContent !== 'undefined' && menuContent !== null) {
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
            var mutasiA = menuContent.document.getElementsByTagName("a")[2];
            mutasiA.click();
        }
    });
});
casper.then(function() {
    if (DEBUG) {
        this.capture('bca-mutasi.png');
    }
});


// download mutasi CSV
casper.then(function() {
    var res = this.page.evaluate(function() {
        var res = {};
        res.post = null;
        var menu = document.getElementsByName("atm")[0];
        var menuContent = menu.contentWindow;
        if (typeof menuContent !== 'undefined' && menuContent != null) {
            f = menuContent.document.iBankForm;

            f.onsubmit = function() {
                //iterate the form fields to construct POST
                var post = {};
                for (i = 0; i < f.elements.length; i++) {
                    post[f.elements[i].name] = f.elements[i].value;
                }
                res.action = f.action;
                res.post   = post;
                return false; //Stop form submission
            };

            // trigger the `f.onsubmit` above
            var mutasiA = menuContent.document.getElementsByName("value(submit2)")[0];
            mutasiA.click();
        }
        return res; //Return the form data to casper
    });

    // alter the `res` - manipulate fDT and tDt
    delete res.post;
    res.post = {};
    res.post['value(fDt)'] = firstDayString;
    res.post['value(tDt)'] = lastDayString;
    res.post['value(r1)']  = '2';
    res.post['value(D1)']  = '0';
    res.post['value(x)']   = '1';

    // <input type="hidden" name="value(fDt)" id="fDt" value="0112">
    // <input type="hidden" name="value(tDt)" id="tDt" value="3112">

    // "action": "https://ibank.klikbca.com/stmtdownload.do?value(actions)=account_statement",
    // "post": {
    //     "value(D1)": "0",
    //     "value(endDt)": "02",
    //     "value(endMt)": "2",
    //     "value(endYr)": "2017",
    //     "value(fDt)": "",
    //     "value(r1)": "2",
    //     "value(startDt)": "02",
    //     "value(startMt)": "2",
    //     "value(startYr)": "2017",
    //     "value(submit1)": "View Account Statement",
    //     "value(submit2)": "Statement Download",
    //     "value(tDt)": "",
    //     "value(x)": "0"
    // }
    if (DEBUG) {
        util.dump(res);
    }
    var fileName = "mutasi_" + username+"_"+ whatYear + whatMonth + ".csv";
    casper.download(res.action, fileName, "POST", res.post);
    console.log("[RES] = "+ fileName);
});

casper.then(function() {
    die(0);
});

casper.run(function() {
    this.exit(0);
});