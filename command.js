const rp = require('request-promise');
const path = require('path');
const _ = require('underscore');

/* let name = require(path.join(__dirname, 'name.json'));
let id = _.invert(name);

let role = require(path.join(__dirname, 'role.json')); */

let myroom = 'Rd8dfbf9649866f65eb5a26a2c7660acd';
let mygroup = 'C2b43bf38767fa6acaf01e5e1327d188f';

class Command {
  constructor(db) {
    let self = this;
    self.db = db;
  }

  static handleError(err) {
    console.log(err);
    Command.sendText(id.jew, err);
    Command.sendText(id.book, err);
  }

  static sendText(to, text) {
    let data = {
      to: to,
      messages: [
        {
          type: 'text',
          text: text + ''
        }
      ]
    }
    return rp({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ***REMOVED***'
      },
      url: 'https://api.line.me/v2/bot/message/push',
      method: 'POST',
      body: data,
      json: true
    })
    .catch(Command.handleError);
  }

  static reportMoney(name, money, point) {
    if(point === undefined) return name + ': ' + money.toFixed(0);
    return name + ': ' + money.toFixed(+point);
  }

  listAll() {
    let query = this.db.collection('users').orderBy('money', 'desc').get()
      .then(snapshot => {
        let text = '';
        snapshot.docs.forEach(e => {
          if(e.get('hide')) return ;
          text += Command.reportMoney(e.get('name'), e.get('money'), 2) + '\n';
        });
        Command.sendText(mygroup, text.slice(0, -1));
      })
      .catch(Command.handleError);
  }

  add(who, amount) {
    let query = this.db.collection('users').where('abb', '==', who).get()
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No subject data: ' + who);
        if (snapshot.docs.length > 1) throw new Error('Duplicated data: ' + who);
        // console.log(snapshot.docs[0].get('money'));
        let currentMoney = snapshot.docs[0].get('money') + amount;
        if(isNaN(currentMoney)) throw new Error('Sum is NaN');
        if(currentMoney < 0) throw new Error('Sum(' + currentMoney + ') can\'t be < 0');
        this.db.doc(snapshot.docs[0].ref.path).update({money: currentMoney});
        Command.sendText(mygroup, Command.reportMoney(snapshot.docs[0].get('name'), currentMoney));
      })
      .catch(Command.handleError);
  }

  transfer(who, to, amount) {
    let query = this.db.collection('users').where('abb', '==', who).get()
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No giver\'s data: ' + who);
        if (snapshot.docs.length > 1) throw new Error('Duplicated giver data: ' + who);
        who = snapshot.docs[0];
        return this.db.collection('users').where('abb', '==', to).get();
      })
      .then(snapshot => {
        if (snapshot.empty) throw new Error('No receiver\'s data: ' + to);
        if (snapshot.docs.length > 1) throw new Error('Duplicated receiver data: ' + to);
        to = snapshot.docs[0];
        if(isNaN(amount)) throw new Error('amount is NaN');
        if(who.get('money') < amount) throw new Error('giver\'s money(' + who.get('money') + ') can\'t be < amount(' + amount + ')');
        this.db.doc(who.ref.path).update({money: who.get('money') - amount});
        this.db.doc(to.ref.path).update({money: to.get('money') + amount});
        Command.sendText(mygroup, Command.reportMoney(who.get('name'), (who.get('money') - amount)) + '\n' + Command.reportMoney(to.get('name'), (to.get('money') + amount)));
      })
      .catch(Command.handleError);
  }

  async share(host, member, amount) {
    let snapshot = await this.db.collection('users').where('abb', '==', host).get();
    if (snapshot.empty) throw new Error('No host\'s data: ' + host);
    if (snapshot.docs.length > 1) throw new Error('Duplicated host data: ' + host);
    host = snapshot.docs[0];
    let calc = amount / (member.length + 1);
    if(isNaN(calc)) throw new Error('Something error: got NaN');
    for(const i of member.keys()) {
      snapshot = await this.db.collection('users').where('abb', '==', member[i]).get();
      if (snapshot.empty) throw new Error('No member\'s data: ' + member[i]);
      if (snapshot.docs.length > 1) throw new Error('Duplicated member data: ' + member[i]);
      member[i] = snapshot.docs[0];
      if(member[i].get('money') < calc) throw new Error('Member "' + member[i].get('name') + '" has ' + member[i].get('money') + ', can\'t pay ' + calc);
    } // http://bit.ly/2Mn6dnD

    // no error, lets go
    let text = '';
    for(const i of member.keys()) {
      await member[i].ref.update({money: member[i].get('money') - calc});
      text += Command.reportMoney(member[i].get('name'), member[i].get('money') - calc) + '\n';
    }
    await host.ref.update({money: host.get('money') + calc * member.length});
    text += Command.reportMoney(host.get('name'), host.get('money') + calc * member.length);
    await Command.sendText(mygroup, text);
  }

  async unShare(host, member, amount) {
    let snapshot = await this.db.collection('users').where('abb', '==', host).get();
    if (snapshot.empty) throw new Error('No host\'s data: ' + host);
    if (snapshot.docs.length > 1) throw new Error('Duplicated host data: ' + host);
    host = snapshot.docs[0];
    let calc = amount / (member.length + 1);
    if(isNaN(calc)) throw new Error('Something error: got NaN');
    if(host.get('money') < calc) throw new Error('Host has ' + member[i].get('money') + ', can\'t pay ' + calc);
    for(const i of member.keys()) {
      snapshot = await this.db.collection('users').where('abb', '==', member[i]).get();
      if (snapshot.empty) throw new Error('No member\'s data: ' + member[i]);
      if (snapshot.docs.length > 1) throw new Error('Duplicated member data: ' + member[i]);
      member[i] = snapshot.docs[0];
      // if(member[i].get('money') < calc) throw new Error('Member "' + member[i].get('name') + '" has ' + member[i].get('money') + ', can\'t pay ' + calc);
    } // http://bit.ly/2Mn6dnD

    // no error, lets go
    let text = '';
    for(const i of member.keys()) {
      await member[i].ref.update({money: member[i].get('money') + calc});
      text += Command.reportMoney(member[i].get('name'), member[i].get('money') + calc) + '\n';
    }
    await host.ref.update({money: host.get('money') - calc * member.length});
    text += Command.reportMoney(host.get('name'), host.get('money') - calc * member.length);
    await Command.sendText(mygroup, text);
  }

  async set(who, value) {
    let snapshot = await this.db.collection('users').where('abb', '==', who).get();
    if (snapshot.empty) throw new Error('No subject data: ' + who);
    if (snapshot.docs.length > 1) throw new Error('Duplicated data: ' + who);
    if(isNaN(value)) throw new Error('Value is NaN');
    if(value < 0) throw new Error('value can\'t be < 0');
    await snapshot.docs[0].ref.update({money: value});
    await Command.sendText(mygroup, Command.reportMoney(snapshot.docs[0].get('name'), value));
  }
};

Object.getOwnPropertyNames(Command.prototype).filter(function (p) {
  return typeof Command.prototype[p] === 'function';
}).forEach(e => {
  // console.log(e);
  let f = Command.prototype[e];
  Command.prototype[e] = async function(...args) {
    try {
      await f.call(this, ...args);
    }
    catch(err) {
      Command.handleError(err);
    }
  };
});

module.exports = Command;