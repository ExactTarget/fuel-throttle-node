exports.testSomething = function(test){
    test.expect(1);
    test.ok(true, "this assertion should pass");
    test.done();
};

/* Uncomment this section to verify that nodeunit is working
exports.testSomethingElse = function(test){
    test.ok(false, "this assertion should fail");
    test.done();
};
*/
