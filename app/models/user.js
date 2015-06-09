var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',

  initialize: function(){
    this.on('creating', function(model, attrs, options){
      var salt = model.get('salt') || bcrypt.genSaltSync(10);
      console.log('salt: ', salt)
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('salt', salt);
      model.set('password', hash);
    });

    // this.on('fetching', function(model, attrs, options){
    //   var hash = bcrypt.hashSync(model.get('password'), model.get('salt'));
    // })
  },

  decrypt: function(newPassword, oldSalt){
    return bcrypt.hashSync(newPassword, oldSalt);
  }
});

module.exports = User;

