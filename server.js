const path = require('path');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 8080, ip = process.env.IP || '0.0.0.0';
const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'yehr-bank',
  keyFilename: 'secret/yehr-bank-1e4f5c7633ab.json',
});


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

let name = require(path.join(__dirname, 'name.json'));
let role = require(path.join(__dirname, 'role.json'));

let Command = require(path.join(__dirname, 'command.js'));
command = new Command(db);

app.get('/webhook', (req, res) => {
  res.send('Ok');
  // command.listAll();
  // command.set('j', Infinity);
  // console.log(command.set);
  command.add('j', -100);
  // command.share('b', ['j', 'a'], 60);
});
app.post('/webhook', async function(req, res, next) {
  try {
    console.log(JSON.stringify(req.body));
    var text = req.body.events[0].message && req.body.events[0].message.text;
    var sender = req.body.events[0].source.userId;
    var replyToken = req.body.events[0].replyToken;
    console.log(text);

    let user = await db.collection('users').where('id', '==', sender).get();
    if (user.empty) throw new Error('No host\'s data: ' + host);
    // if (user.docs.length > 1) throw new Error('Duplicated host data: ' + host);

    user = user.docs[0];
    text = text.toLowerCase().trim();
    let chunk = text.split(/\s+/);

    if (text == '$') command.listAll(replyToken);
    else if (chunk.length == 2 && user.get('role') == 'admin') command.add(chunk[0], eval(chunk[1]), replyToken);
    else if (chunk[1] == 't' && eval(chunk[3]) >= 0) {
      if (user.get('role') == 'admin' || user.get('abb') == chunk[0]) command.transfer(chunk[0], chunk[2], eval(chunk[3]), replyToken);
    }
    else if (chunk[1] == 's' && eval(chunk[chunk.length-1]) >= 0 && user.get('role') == 'admin') command.share(chunk[0], chunk.slice(2, chunk.length-1), eval(chunk[chunk.length-1]), replyToken);
    else if (chunk[1] == '!s' && eval(chunk[chunk.length-1]) >= 0 && user.get('role') == 'admin') command.unShare(chunk[0], chunk.slice(2, chunk.length-1), eval(chunk[chunk.length-1]), replyToken);
    else if (chunk[1] == '=' && user.get('role') == 'admin') command.set(chunk[0], eval(chunk[2]), replyToken);
    res.sendStatus(200);
  } catch (err) {
    Command.handleError(err);
  }
});

// start
app.listen(port, ip, () => console.log('Server running on http://%s:%s', ip, port));

// export
module.exports = app;