var { Cm, Ci } = require('chrome');
Cm.QueryInterface(Ci.nsIComponentRegistrar);

exports.SafeProtocol = function(component) {
  this.createInstance = function(outer, iid) {
    if (outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
    }
    return new component();
  };
  this.register = function() {
    if (!Cm.isContractIDRegistered(component.prototype.contractID)) {
       Cm.registerFactory(component.prototype.classID,
        component.prototype.classDescription,
        component.prototype.contractID,
        this);
    }    
  };
  this.unregister = function() {
    if (Cm.isContractIDRegistered(component.prototype.contractID)) {
      Cm.unregisterFactory(component.prototype.classID, this);
    }
  };
  Object.freeze(this);
};
