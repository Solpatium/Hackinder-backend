var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

class Chat {
    costruct(db) {
        this.db = db;
        this.sockets = {};

        io.on('connection', function(socket){
            const db = db;
            let user = null;

            socket.on('login', function(msg){
               const user = JSON.parse(msg);
               db.validateUser(user.login, user.password)
               .then(u => {
                   user = u.login;
                   return Promise.all([
                    db.getUserIdeas(user),
                    db.getUserMatches(user),
                   ]);
               })
               .then( ([ideas, matches]) => {
                   const all = [...ideas, ...matches];
                   const ids = all.map(i => i._id);
                   ids.forEach( id => socket.join(id) );
                   socket.emit('response', 'ok');
               })
               .catch(e => console.log(e));
            });

            socket.on('getMessages', function(msg) {
               if( !user ) return;

               const {ideaId} = JSON.parse(msg);
               db.getMessages(ideaId)
               .then(messages => socket.emit('newMessages', messages) )
               .catch(e => console.log(e));
            });

            socket.on('addMessage', function(msg){
               if(!user) return;
               
               const {idea, content} = JSON.parse(msg);
               io.to(idea).emit('newMessages', [content]);
               db.addMessage(idea, user, content);
            });
        });
          
        http.listen(4000, function(){
           console.log('listening on *:4000');
        });          
    }
}

module.exports = Chat;