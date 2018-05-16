const MongoClient = require('mongodb').MongoClient;
const $ne = MongoClient.$ne;
const $exists = MongoClient.$exists;
const $set = MongoClient.$set;
const $or = MongoClient.$or;
const ObjectId = require('mongodb').ObjectID;
const assert = require('assert');
const sha256 = require('js-sha256');


console.log("TEST ");

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'hackinder';

const cracow = 'cracow';

const loremIpsum = 'Lorem Ipsum jest tekstem stosowanym jako przykładowy wypełniacz w przemyśle poligraficznym. Został po raz pierwszy użyty w XV w. przez nieznanego drukarza do wypełnienia tekstem próbnej książki. Pięć wieków później zaczął być używany przemyśle elektronicznym, pozostając praktycznie niezmienionym. Spopularyzował się w latach 60. XX w. wraz z publikacją arkuszy Letrasetu, zawierających fragmenty Lorem Ipsum, a ostatnio z zawierającym różne wersje Lorem Ipsum oprogramowaniem przeznaczonym do realizacji druków na komputerach osobistych, jak Aldus PageMaker';

class Db {
    setup(client) {
        this.client = client;
        this.users = this.client.collection('users');
        this.ideas = this.client.collection('ideas');
        this.users.remove({})
        this.ideas.remove({})
        this.addMockUsers();
        this.addMockIdeas();
    }

    addMockUsers() {
        this.users.insertMany([
            {
                login: 'kuba',
                hash: sha256('ala'),
                localization: cracow,
                fullname: 'Kuba Ptak',
                token: 'a'
            },
            {
                login: 'maks',
                hash: sha256('ala'),
                localization: cracow,
                fullname: 'Maks Rojek',
                token: 'a'
            },
            {
                login: 'przemek',
                hash: sha256('ala'),
                localization: cracow,
                fullname: 'Przemysław Moskała',
                token: 'a'
            },
        ], function(err, result) {
            assert.equal(err, null);
            console.log("Added users");
        });
    }

    addMockIdeas() {
        this.ideas.insertMany([
            {
                title: 'MOŻESZ DUŻO ZAROBIĆ',
                description: loremIpsum,
                image: 'https://picsum.photos/300',
                localization: cracow,
                user: 'test',
                swipes: {},
                messages: []
            },
            {
                title: 'Marketing wielopoziomowy',
                description: loremIpsum,
                image: 'https://picsum.photos/301',
                localization: cracow,
                user: 'test',
                swipes: {
                    'kuba': 'right'
                },
                messages: []
            },
            {
                title: 'Hackaton expo',
                description: loremIpsum,
                image: 'https://picsum.photos/302',
                localization: cracow,
                user: 'test',
                swipes: {
                    'maks': 'right',
                    'przemek': 'right',
                    'kuba': 'right'
                },
                messages: []
            },
            {
                title: 'Zróbcie mi taką appkę plis',
                description: loremIpsum,
                image: 'https://picsum.photos/303',
                localization: cracow,
                user: 'test',
                swipes: {},
                messages: []
            },
            {
                title: 'Zróbmy razem naleśniki',
                description: loremIpsum,
                image: 'https://picsum.photos/304',
                localization: cracow,
                user: 'test',
                swipes: {},
                messages: []
            }
        ], function(err, result) {
            assert.equal(err, null);
            console.log("Added users");
        })
    }

    createToken(username, hash) {
        console.log(username, hash)
        const token = sha256('' + Math.random());

        return this.users.find({
            login: username,
            hash: hash.toLowerCase()
        }).toArray()
        .then(r => {
            console.log(r[0].hash)
            if( r.length > 0 ) {
                this.users.update({
                    user: username
                }, {
                    $set: {token: token}
                })
            } else {
                throw new Error('Invalid user credentials');
            }
        })
        .then(_ => token);
    }

    validAccess(username, token) {
        return this.users.find({
            login: username,
            token: token
        }).toArray();
    }

    addIdea(user, title, description, image, localization) {
        return this.ideas.insertOne({
            title: title,
            description: description,
            image: image,
            localization: localization,
            user: user,
            swipes: {},
            messages: []
        });
    }

    addMessage(ideaId, user, message) {
        const messageBody = {
            date: + new Date(),
            sender: user,
            content: message
        }

        return this.ideas.update({
            _id: new ObjectId(ideaId),
        }, {
            $push: {'messages': messageBody}
        });
    }

    getMessages(ideaId) {
        return this.ideas.find({
            _id: new ObjectId(ideaId)
        }).toArray()
        .then(ideas => {
           if( ideas.length > 0 ) {
               return ideas[0].messages;
           } else {
               return [];
           }
        });
    }

    addSwipe(ideaId, user, direction) {
        const updateKey = 'swipes.' + user;
        
        return this.ideas.update({
            _id: new ObjectId(ideaId),
        }, {
            $set: {[updateKey]: direction}
        });
    }

    getUserIdeas(login) {
        return this.ideas.find({
            user: login,
        }).toArray();
    }

    getIdeasForUser(login) {
        const userSwipes = 'swipes.' + login;

        return this.ideas.find({
            user: {$ne: login},
            [userSwipes]: {$exists: false}
        }).toArray();
    }

    getUserMatches(login) {
        const userSwipes = 'swipes.' + login;
        return this.ideas.find({
            [userSwipes]: 'right'
        }).toArray();
    }

}

const dbClient = new Db();

// Use connect method to connect to the server
MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);
  dbClient.setup(db);
//   client.close();
});

module.exports = dbClient;



