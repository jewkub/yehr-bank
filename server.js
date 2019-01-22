const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 8080, ip = process.env.IP || '0.0.0.0';
const request = require('request');
const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'yehr-bank',
  // keyFilename: '/YEHR Bank-bfd94eae6547.json',
  timestampsInSnapshots: true
});


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

let jew = 'U4e1741882564169e6c4f71f9c9ce64b1';
let book = 'U2dcf72d7e03329fd617447718821ac07';
let role = {
  // U4e1741882564169e6c4f71f9c9ce64b1: 'admin',
  // U2dcf72d7e03329fd617447718821ac07: 'admin',
};
role[jew] = 'admin';
role[book] = 'admin';
let myroom = 'Rd8dfbf9649866f65eb5a26a2c7660acd';
let mygroup = 'C2b43bf38767fa6acaf01e5e1327d188f';

function sendText(to, text) {
  let data = {
    to: to,
    messages: [
      {
        type: 'text',
        text: text + ''
      }
    ]
  }
  request({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ***REMOVED***'
    },
    url: 'https://api.line.me/v2/bot/message/push',
    method: 'POST',
    body: data,
    json: true
  }, function (err, res, body) {
    if (err) console.log('error')
    // if (res) console.log('success')
    // if (body) console.log(body)
  });
}

let command = {
  handleError: err => {
    console.log(err);
    sendText(jew, err);
    sendText(book, err);
  },
  listAll: function() {
    let query = db.collection('users').orderBy('money', 'desc').get()
      .then(snapshot => {
        let text = '';
        snapshot.docs.forEach(e => {
          // sendText(mygroup, e.get('name') + ': ' + e.get('money'));
          text += e.get('name') + ': ' + e.get('money') + '\n';
        });
        sendText(mygroup, text.slice(0, -1));
      })
      .catch(this.handleError);
  },
  add: function(who, amount) {
    let query = db.collection('users').where('abb', '==', who).get()
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No subject data: ' + who);
        if (snapshot.docs.length > 1) throw new Error('Duplicated data: ' + who);
        console.log(snapshot.docs[0].get('money'));
        let currentMoney = snapshot.docs[0].get('money') + amount;
        if(isNaN(currentMoney)) throw new Error('Sum is NaN');
        if(currentMoney < 0) throw new Error('Sum(' + currentMoney + ') can\'t be < 0');
        db.doc(snapshot.docs[0].ref.path).update({money: currentMoney});
        sendText(mygroup, snapshot.docs[0].get('name') + ': ' + currentMoney);
      })
      .catch(this.handleError);
  },
  transfer: function(who, to, amount) {
    let query = db.collection('users').where('abb', '==', who).get()
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No giver\'s data: ' + who);
        if (snapshot.docs.length > 1) throw new Error('Duplicated giver data: ' + who);
        who = snapshot.docs[0];
        return db.collection('users').where('abb', '==', to).get();
      })
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No receiver\'s data: ' + to);
        if (snapshot.docs.length > 1) throw new Error('Duplicated receiver data: ' + to);
        to = snapshot.docs[0];
        if(who.get('money') < amount) throw new Error('giver\'s money(' + who.get('money') + ') can\'t be < amount(' + amount + ')');
        db.doc(who.ref.path).update({money: who.get('money') - amount});
        db.doc(to.ref.path).update({money: to.get('money') + amount});
        sendText(mygroup, who.get('name') + ': ' + (who.get('money') - amount) + '\n' + to.get('name') + ': ' + (to.get('money') + amount));
      })
      .catch(this.handleError);
  },
  share: async function(host, member, amount) {
    try {
      let snapshot = await db.collection('users').where('abb', '==', host).get();
      if (snapshot.empty) throw new Error('No host\'s data: ' + host);
      if (snapshot.docs.length > 1) throw new Error('Duplicated host data: ' + host);
      host = snapshot.docs[0];
      let calc = amount / (member.length + 1);
      for(const i of member.keys()) {
        snapshot = await db.collection('users').where('abb', '==', member[i]).get();
        if (snapshot.empty) throw new Error('No member\'s data: ' + member[i]);
        if (snapshot.docs.length > 1) throw new Error('Duplicated member data: ' + member[i]);
        member[i] = snapshot.docs[0];
        if(member[i].get('money') < calc) throw new Error('Member "' + member[i] + '" has ' + member[i].get('money') + ', can\'t pay ' + calc);
      } // http://bit.ly/2Mn6dnD

      // no error, lets go
      for(const i of member.keys()) {
        await member[i].ref.update({money: member[i].get('money') - calc});
      }
      await host.ref.update({money: host.get('money') + calc * member.length});
    }
    catch(err) {
      this.handleError(err);
    }
  }
};

app.get('/webhook', (req, res) => {
  res.send('Ok');
  // command.share('b', ['j', 'a'], 30);
});
app.post('/webhook', (req, res, next) => {
  console.log(req.body.events[0]);
  var text = req.body.events[0].message && req.body.events[0].message.text
  var sender = req.body.events[0].source.userId
  var replyToken = req.body.events[0].replyToken
  console.log(text);
  if (role[sender] == 'admin') {
    text = text.toLowerCase().trim();
    let chunk = text.split(/\s+/);
    // chunk[0] = chunk[0].toLowerCase();
    // chunk[2] = chunk[2].toLowerCase();
    if(text == '$') command.listAll();
    else if(chunk.length == 2) command.add(chunk[0], +chunk[1]);
    else if(chunk[1] == 'T' || chunk[1] == 't') {
      if(+chunk[3] >= 0) command.transfer(chunk[0], chunk[2], +chunk[3]);
      else command.transfer(chunk[2], chunk[0], -chunk[3]);
    }
    else if(chunk[1] == 'S' || chunk[1] == 's') {
      if(+chunk[chunk.length-1] >= 0) command.share(chunk[0], chunk.slice(2, chunk.length-1), +chunk[chunk.length-1]);
      else command.listAll();
    }
  }
  else {
    sendText(sender, '?');
  }
  res.sendStatus(200);
});

// start
app.listen(port, ip, () => console.log('Server running on http://%s:%s', ip, port));

// export
module.exports = app;