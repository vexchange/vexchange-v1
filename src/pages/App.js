import React, { Component } from 'react';
import { connect } from 'react-redux';
import { BrowserRouter, Redirect, Route } from 'react-router-dom';
import { hexToBytes } from 'web3-utils';
import { isEqual } from 'lodash';
import MediaQuery from 'react-responsive';
import { AnimatedSwitch } from 'react-router-transition';
import { ConnexConnect, startWatching, initialize } from '../ducks/connexConnect';
import { setAddresses } from '../ducks/addresses';
import Header from '../components/Header';
import TosModal from '../components/TosModal';
import Swap from './Swap';
import Send from './Send';
import Pool from './Pool';
import Tos from './Tos';

import './App.scss';

class App extends Component {
  componentDidMount() {
    const { initialize, startWatching } = this.props;
    initialize().then(startWatching);
  }

  componentWillReceiveProps({ connex }) {
    if (connex && isEqual(this.props.connex, connex)) {
      connex.thor.block(0).get().then(block => {
        const networkId = hexToBytes(block.id);
        setAddresses(networkId);
        this.hasSetNetworkId = true;
      });
    }
  }

  render() {

    if (!this.props.initialized) {
      return <noscript />;
    }

    return (
      <div id="app-container">
        <MediaQuery query="(min-width: 768px)">
          <Header />
        </MediaQuery>

        <ConnexConnect />

        <BrowserRouter>
          <>
            <AnimatedSwitch
              atEnter={{ opacity: 0 }}
              atLeave={{ opacity: 0 }}
              atActive={{ opacity: 1 }}
              className="app__switch-wrapper"
            >
              <Route exact path="/swap" component={Swap} />
              <Route exact path="/send" component={Send} />
              <Route exact path="/add-liquidity" component={Pool} />
              <Route exact path="/remove-liquidity" component={Pool} />
              <Route exact path="/create-exchange/:tokenAddress?" component={Pool} />
              <Route exact path="/terms-of-service" component={Tos} />
              <Redirect exact from="/" to="/swap" />

            </AnimatedSwitch>

          </>
        </BrowserRouter>
        <div>
          <TosModal />
        </div>
      </div>
    );
  }
}

export default connect(
  (state, props) => ({
    account: state.connexConnect.account,
    initialized: state.connexConnect.initialized,
    connex: state.connexConnect.connex,
  }),
  dispatch => ({
    setAddresses: networkId => dispatch(setAddresses(networkId)),
    initialize: () => dispatch(initialize()),
    startWatching: () => dispatch(startWatching()),
  }),
)(App);
