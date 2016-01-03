import { expect } from 'chai';
import sinon, { spy } from 'sinon';
import { Router5 } from '../modules';
import createRouter from './_create-router';

const noop = () => {};

let router;
const listeners = {
    transition: (toState, fromState, done) => {
        const newState = {
            name: toState.name,
            params: toState.params,
            path: toState.path,
            hitMware: true
        };
        done(null, newState);
    },
    transitionMutate: (toState, fromState, done) => {
        const newState = {
            name: toState.name + 'modified',
            params: toState.params,
            path: toState.path,
            hitMware: true
        }
        done(null, newState);
    },
    transitionErr: (toState, fromState, done) => {
        done({ reason: 'because' });
    },
    noop: function () {}
};

const myPlugin = router => {
    router.myCustomMethod = function () {};

    return {
        name: 'PLUGIN_NAME',
        onTransitionStart: function onTransitionStart() {},
        onTransitionSuccess: function onTransitionSuccess() {},
        onTransitionError: function onTransitionError() {}
    };
};

const base = window.location.pathname;

const hashPrefix = '!';

function getExpectedPath(useHash, path) {
    return useHash ? '#' + hashPrefix + path : path;
}

function omitMeta(obj) {
    if (!obj._meta) {
        console.log('no meta')
    }
    return {
        name: obj.name,
        params: obj.params,
        path: obj.path
    };
}

describe('router5', function () {
    // Without hash
    testRouter(false);

    // With hash
    testRouter(true);
});

function testRouter(useHash) {
    describe(useHash ? 'with using URL hash part' : 'without using URL hash part', () => {
        let router, sandbox;

        before(() => router = createRouter(base, useHash, hashPrefix));
        after(() => router.stop());

        afterEach(() => sandbox.restore());
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            router._cbs = {};
        });

        function makeUrl(path) {
            return 'https://www.mysite.com:8080' + base + (useHash ? '#' + hashPrefix : '' ) + path;
        }

        it('should throw an error if Router5 is not used as a constructor', function () {
            expect(() => Router5([])).to.throw();
        });

        it('should expose RouteNode path building function', function () {
            expect(router.buildPath('users.list')).to.equal('/users/list');
        });

        it('should buildUrl', function () {
            expect(router.buildUrl('users.list')).to.equal(base + getExpectedPath(useHash, '/users/list'));
            expect(router.buildUrl('users.view', {id: 1})).to.equal(base + getExpectedPath(useHash, '/users/view/1'));
        });

        it('should be able to extract the path of an URL', function () {
            expect(router.urlToPath(makeUrl('/home'))).to.equal('/home');
            expect(() => router.urlToPath('')).to.throw();
        });

        it('should match an URL', function () {
            expect(omitMeta(router.matchUrl(makeUrl('/home')))).to.eql({name: 'home', params: {}, path: '/home'});
            expect(omitMeta(router.matchUrl(makeUrl('/users/view/1')))).to.eql({name: 'users.view', params: {id: '1'}, path: '/users/view/1'});
        });

        it('should start with the default route', function (done) {
            expect(router.getState()).to.equal(null)
            expect(router.isActive('home')).to.equal(false)

            router.start('', function () {
                expect(router.started).to.equal(true);
                expect(omitMeta(router.getState())).to.eql({name: 'home', params: {}, path: '/home'});
                done();
            });
        });
        it('should not throw an error when starting with no callback', function() {
            router.stop();
            expect(() => router.start()).not.to.throw();
        });

        it('should give an error if trying to start when already started', function (done) {
            router.start('', function (err) {
                expect(err.code).to.equal(Router5.ERR.ROUTER_ALREADY_STARTED);
                done();
            });
        });

        it('should start with the start route if matched', function (done) {
            router.stop();
            router.start('/users/view/123', function (err, state) {
                expect(omitMeta(state)).to.eql({name: 'users.view', params: {id: '123'}, path: '/users/view/123'});
                done();
            });
        });

        it('should start with the default route if start route is not matched', function (done) {
            router.stop();
            router.lastKnownState = null;
            router.lastStateAttempt = null;
            router.start('/about', function (err, state) {
                expect(omitMeta(router.getState())).to.eql({name: 'home', params: {}, path: '/home'});
                done();
            });
        });

        it('should start with the default route if navigation to start route is not allowed', function (done) {
            router.stop();
            router.start('/admin', function (err) {
                expect(omitMeta(router.getState())).to.eql({name: 'home', params: {}, path: '/home'});
                done();
            });
        });

        it('should start with an error if navigation to start route is not allowed and no default route is specified', function (done) {
            router.stop();
            router.setOption('defaultRoute', null);
            router.start('/admin', function (err) {
                expect(err.code).to.equal(Router5.ERR.CANNOT_ACTIVATE);
                expect(err.segment).to.equal('admin');
                done();
            });
        });

        it('should start with a not found error if no matched start state and no default route', function (done) {
            router.stop();
            router.setOption('defaultRoute', null);
            router.start('', function (err) {
                expect(err.code).to.equal(Router5.ERR.ROUTE_NOT_FOUND);
                done();
            });
        });

        it('should not match an URL with extra trailing slashes', function (done) {
            router.stop();
            router.start('/users/list/', function (err, state) {
                expect(err.code).to.equal(Router5.ERR.ROUTE_NOT_FOUND);
                expect(state).to.equal(null);
                done();
            });
        });

        it('should match an URL with extra trailing slashes', function (done) {
            router.setOption('trailingSlash', 1);
            router.stop();
            router.start('/users/list/', function (err, state) {
                expect(omitMeta(state)).to.eql({name: 'users.list', params: {}, path: '/users/list/'});
                router.setOption('trailingSlash', 0);
                done();
            });
        });

        it('should match an URL with extra trailing slashes', function (done) {
            router.setOption('trailingSlash', 1);
            router.stop();
            router.start('/users/list/', function (err, state) {
                expect(omitMeta(state)).to.eql({name: 'users.list', params: {}, path: '/users/list/'});
                router.setOption('trailingSlash', 0);
                done();
            });
        });

        it('should start with the provided state', function (done) {
            router.stop();
            var homeState = {name: 'home', params: {}, path: '/home', _meta: {'home': {}}};
            router.start(homeState, function (err, state) {
                expect(state).to.eql(homeState);
                expect(router.lastKnownState).to.eql(homeState);
                done();
            });
        });

        it('should return an error if default route access is not found', function (done) {
            router.stop();
            router.setOption('defaultRoute', 'fake.route');

            router.start('', function(err, state) {
                expect(err.code).to.equal(Router5.ERR.ROUTE_NOT_FOUND);
                done();
            });
        });

        it('should be able to navigate to routes', function (done) {
            router.navigate('users.view', {id: 123}, {}, function (err, state) {
                expect(omitMeta(state)).to.eql({name: 'users.view', params: {id: 123}, path: '/users/view/123'});
                done();
            });
        });

        it('should return an error if trying to navigate to an unknown route', function (done) {
            router.navigate('fake.route', {}, {}, function (err, state) {
                expect(err.code).to.equal(Router5.ERR.ROUTE_NOT_FOUND);
                done();
            });
        });

        it('should navigate to same state if reload is set to true', function (done) {
            router.navigate('orders.pending', {}, {}, function (err, state) {
                router.navigate('orders.pending', {}, {}, function (err, state) {
                    expect(err.code).to.equal(Router5.ERR.SAME_STATES);

                    router.navigate('orders.pending', {}, {reload: true}, function (err, state) {
                        expect(err).to.equal(null);
                        done();
                    });
                });
            });
        });

        it('should be able to stop routing', function (done) {
            router.navigate('users', {}, {}, function () {
                router.stop();
                expect(router.started).to.equal(false);
                router.navigate('users.list', {}, {}, function (err) {
                    expect(err.code).to.equal(Router5.ERR.ROUTER_NOT_STARTED);
                    // Stopping again shouldn't throw an error
                    router.stop();
                    router.start('', () => done());
                });
            });
        });

        // it('should not start with default route if current path matches an existing route', function (done) {
        //     router.start(function (err, state) {
        //         expect(router.getState()).to.eql({name: 'orders.pending', params: {}, path: '/orders/pending'});
        //         done();
        //     });
        // });

        it('should be able to register components', function () {
            router.registerComponent('users.view', {});
            expect(router._cmps['users.view']).not.to.equal(undefined);

            router.registerComponent('users.list', {});
            expect(router._cmps['users.list']).not.to.equal(undefined);

            router.deregisterComponent('users.list');
            expect(router._cmps['users.list']).to.equal(undefined);

            router.deregisterComponent('users.view');
            expect(router._cmps['users.view']).to.equal(undefined);
        });

        it('should block navigation if a component refuses deactivation', function (done) {
            router.navigate('users.list', {}, {}, function () {
                // Cannot deactivate
                router.registerComponent('users.list', {
                    canDeactivate: function () {
                        return Promise.reject();
                    }
                });
                router.navigate('users', {}, {}, function (err) {
                    expect(err.code).to.equal(Router5.ERR.CANNOT_DEACTIVATE);
                    expect(err.segment).to.equal('users.list');
                    expect(omitMeta(router.getState())).to.eql({name: 'users.list', params: {}, path: '/users/list'});

                    // Can deactivate
                    router.deregisterComponent('users.list');
                    router.registerComponent('users.list', {
                        canDeactivate: function () {
                            return true;
                        }
                    });
                    router.navigate('users', {}, {}, function () {
                        expect(omitMeta(router.getState())).to.eql({name: 'users', params: {}, path: '/users'});
                        // Auto clean up
                        expect(router._cmps['users.list']).to.equal(undefined);
                        done();
                    });
                });
            });
        });

        it('should register can deactivate status', function (done) {
            router.navigate('users.list', {}, {}, function (err) {
                router.canDeactivate('users.list', false);
                router.navigate('users', {}, {}, function (err) {
                    expect(err.code).to.equal(Router5.ERR.CANNOT_DEACTIVATE);
                    expect(err.segment).to.equal('users.list');
                    router.canDeactivate('users.list', true);
                    router.navigate('users', {}, {}, function (err) {
                        expect(err).to.equal(null);
                        done();
                    });
                });
            });
        });

        it('should throw if trying to use canDeactivate with autoCleanUp to false', function () {
            router.setOption('autoCleanUp', false);
            expect(() => router.canDeactivate('users.list', true)).to.throw();
            router.setOption('autoCleanUp', true);
        });

        it('should warn when trying to register a component twice', function () {
            sandbox.stub(console, 'warn', noop);
            router.registerComponent('users.view', {});
            router.registerComponent('users.view', {});
            expect(console.warn).to.have.been.called;
        });

        it('should tell if a route is active or not', function () {
            router.navigate('users.view', {id: 1});
            expect(router.isActive('users.view', {id: 1})).to.equal(true);
            expect(router.isActive('users.view', {id: 2})).to.equal(false);
            expect(router.isActive('users.view')).to.equal(false);
            expect(router.isActive('users')).to.equal(true);
            expect(router.isActive('users', {}, true)).to.equal(false);

            router.navigate('section.query', {section: 'section1'});
            expect(router.isActive('section', {section: 'section1'})).to.equal(true);
            expect(router.isActive('section.query', {section: 'section1', param1: '123'})).to.equal(true);
            expect(router.isActive('section.query', {section: 'section2'})).to.equal(false);
            expect(router.isActive('section.query', {section: 'section1', param2: '123'}, false, false)).to.equal(false);
            expect(router.isActive('users.view', {id: 123})).to.equal(false);
        });

        it('should block navigation if a route cannot be activated', function (done) {
            router.navigate('home', {}, {}, function () {
                router.navigate('admin', {}, {}, function (err) {
                    expect(err.code).to.equal(Router5.ERR.CANNOT_ACTIVATE);
                    expect(err.segment).to.equal('admin');
                    expect(router.isActive('home')).to.equal(true);
                    done();
                });
            });
        });

        it('should be able to cancel a transition', function (done) {
            router.canActivate('admin', function canActivate(done) { return Promise.resolve(); });
            var cancel = router.navigate('admin', {}, {}, function (err) {
                expect(err.code).to.equal(Router5.ERR.TRANSITION_CANCELLED);
                done();
            });
            cancel();
        });

        it('should register plugins', function (done) {
            expect(() => router.usePlugin(myPlugin)).not.to.throw();
            expect(router.myCustomMethod).not.to.equal(undefined);
            expect(router.registeredPlugins.PLUGIN_NAME).to.exist;

            router.navigate('orders', {}, {}, function (err, state) {
                // expect(myPlugin.onTransitionStart).to.have.been.called;
                // expect(myPlugin.onTransitionSuccess).to.have.been.called;
                done();
            });
        });

        it('should throw if a plugin has none of the expected methods', function () {
            expect(() => {
                sandbox.stub(console, 'warn', noop);
                router.usePlugin({});
            }).to.throw();
        });

        it('should throw when registering unamed plugins', function() {
            expect(() => router.usePlugin(() => ({
                onTransitionStart: () => {}
            }))).to.throw();
        });

        it('should support a transition middleware', function (done) {
            sandbox.spy(listeners, 'transition');
            router.useMiddleware(router => listeners.transition);
            router.navigate('users', {}, {}, function (err, state) {
                expect(listeners.transition).to.have.been.called;
                expect(state.hitMware).to.equal(true);
                expect(err).to.equal(null);
                done();
            });
        });

        it('should refuse to mutate its state during a transition', function (done) {
            sandbox.stub(console, 'error');
            router.useMiddleware(router => listeners.transitionMutate);
            router.navigate('orders', {}, {}, function (err, state) {
                expect(console.error).to.have.been.called;
                expect(err).to.equal(null);
                done();
            });
        });

        it('should fail transition if middleware returns an error', function (done) {
            sandbox.spy(listeners, 'transitionErr');
            router.useMiddleware(router => listeners.transitionErr);
            router.navigate('home', {}, {}, function (err, state) {
                expect(listeners.transitionErr).to.have.been.called;
                expect(err.code).to.equal(Router5.ERR.TRANSITION_ERR);
                expect(err.reason).to.equal('because');
                done();
            });
        });

        it('should be able to take more than one middleware', function (done) {
            sandbox.spy(listeners, 'transition');
            sandbox.spy(listeners, 'transitionErr');
            router.useMiddleware(router => listeners.transition, router => listeners.transitionErr);
            router.navigate('home', {}, {}, function (err, state) {
                expect(listeners.transition).to.have.been.called;
                expect(listeners.transitionErr).to.have.been.called;
                done();
            });
        });
    });
}
