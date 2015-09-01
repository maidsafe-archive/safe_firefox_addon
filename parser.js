exports.parse = function (uriPath) {
  var serviceName;
  var publicName;
  var tokens = uriPath.split('/');
  var filePath = '';
  if (tokens.length > 1) { // .join() is not available (SDK Array type)
    for (var i = 1; i < tokens.length; i++) {
      filePath += tokens[i];
      if (i + 1 !== tokens.length) {
        filePath += '/';
      }
    }
  }
  tokens = tokens[0].split('.');
  if (tokens.length === 1) { // if the service is not mentioned in the URI, eg: safe:maidsafe.net
    serviceName = 'www'; // default lookup service
    publicName = tokens[0];
  } else {
    serviceName = tokens[0];
    publicName = tokens[1];
  }
  // Set default file to lookup if filePath is empty
  if (!filePath) {
    filePath = 'index.html';
  }
  return {service: serviceName, publicName: publicName, filePath: filePath}
};