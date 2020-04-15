exports.handler = function(event, context) {
    console.log("Hello Alex in console");
    context.succeed("Hello, World!");
};