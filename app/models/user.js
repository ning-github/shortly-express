var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',

  // synchronous bcrypt encryption
  initialize: function(){
    this.on('creating', function(model, attrs, options){
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('salt', salt);
      model.set('password', hash);
    });
  },

  // asynchronous bcrypt encryption
  // initialize: function(){
  //   this.on('creating', function(model, attrs, options){
  //     bcrypt.genSalt(10, function(err, salt){
  //       model.set('salt', salt);
  //       bcrypt.hash(model.get('password'), salt, function(err, hash){
  //         model.set('password', hash);
  //       })
  //     })
  //   });
  // },

  decrypt: function(newPassword, oldSalt){
    return bcrypt.hashSync(newPassword, oldSalt);
  }
});

module.exports = User;

