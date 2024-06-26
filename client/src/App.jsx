import { useState, useEffect } from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import Wallet from "./Wallet.jsx";
import NewOrder from "./NewOrder.jsx";
import AllOrders from "./AllOrders.jsx";
import MyOrders from "./MyOrders.jsx";
import AllTrades from "./AllTrades.jsx";
import { Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./Home.jsx";
import PageWallet from "./PageWallet.jsx";

const SIDE = {
  BUY: 0,
  SELL: 1,
};

function App({ web3, accounts, contracts }) {
  const [tokens, setTokens] = useState([]);
  const [tradeableTokens, setTradeableTokens] = useState([]);

  const [user, setUser] = useState({
    accounts: [],
    balances: {
      tokenDex: 0,
      tokenWallet: 0,
    },
    selectedToken: undefined,
  });

  const [orders, setOrders] = useState({
    buy: [],
    sell: [],
  });

  const [trades, setTrades] = useState([]);
  const [listener, setListener] = useState(undefined);
  const [tradeIds, setTradeIds] = useState(new Set());

  const getBalances = async (account, token) => {
    const bytes32Ticker = web3.utils.fromAscii(token.ticker).padEnd(66, "0");

    const tokenDex = await contracts.dex.methods
      .getTraderBalances(account, bytes32Ticker)
      .call();

    const tokenWallet = await contracts[token.ticker].methods
      .balanceOf(account)
      .call();

    return { tokenDex, tokenWallet };
  };

  const getOrders = async (token) => {
    const bytes32Ticker = web3.utils.fromAscii(token.ticker).padEnd(66, "0");

    const orders = await Promise.all([
      contracts.dex.methods.getOrders(bytes32Ticker, SIDE.BUY).call(),
      contracts.dex.methods.getOrders(bytes32Ticker, SIDE.SELL).call(),
    ]);

    return { buy: orders[0], sell: orders[1] };
  };

  const listenToTrades = (token) => {
    setTradeIds(new Set());
    setTrades([]);
    const listener = contracts.dex.events
      .newTrade({
        filter: { ticker: web3.utils.fromAscii(token.ticker).padEnd(66, "0") },
        fromBlock: 0,
      })
      .on("data", (newTrade) => {
        if (tradeIds.has(newTrade.returnValues.tradeId)) return;

        console.log(tradeIds);
        tradeIds.add(newTrade.returnValues.tradeId);
        setTrades((trades) => [...trades, newTrade.returnValues]);
      });
    setListener(listener);
  };

  const selectToken = (token) => {
    setUser({ ...user, selectedToken: token });
  };

  const deposit = async (amount) => {
    await contracts[user.selectedToken.ticker].methods
      .approve(contracts.dex.options.address, amount)
      .send({ from: user.accounts[0] });
    await contracts.dex.methods
      .deposit(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({ from: user.accounts[0] });
    const balances = await getBalances(user.accounts[0], user.selectedToken);
    setUser((user) => ({ ...user, balances }));
  };

  const withdraw = async (amount) => {
    await contracts.dex.methods
      .withdraw(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({ from: user.accounts[0] });
    const balances = await getBalances(user.accounts[0], user.selectedToken);
    setUser((user) => ({ ...user, balances }));
  };

  const createMarketOrder = async (amount, side) => {
    await contracts.dex.methods
      .createMarketOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        side
      )
      .send({ from: user.accounts[0] });
    const orders = await getOrders(user.selectedToken);
    setOrders(orders);
  };

  const createLimitOrder = async (amount, price, side) => {
    await contracts.dex.methods
      .createLimitOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        price,
        side
      )
      .send({ from: user.accounts[0] });
    const orders = await getOrders(user.selectedToken);
    setOrders(orders);
  };

  useEffect(() => {
    const init = async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map((token) => ({
        ...token,
        ticker: web3.utils.hexToUtf8(token.ticker),
      }));

      const [balances, orders] = await Promise.all([
        getBalances(accounts[0], tokens[1]),
        getOrders(tokens[1]),
      ]);
      setTokens(tokens);
      setTradeableTokens(tokens.slice(1));
      setUser({ ...user, accounts, balances, selectedToken: tokens[1] });
      setOrders(orders);
    };
    init();
  }, []);

  useEffect(
    () => {
      const init = async () => {
        const [balances, orders] = await Promise.all([
          getBalances(user.accounts[0], user.selectedToken),
          getOrders(user.selectedToken),
        ]);
        listenToTrades(user.selectedToken);
        setUser((user) => ({ ...user, balances }));
        setOrders(orders);
      };
      if (typeof user.selectedToken !== "undefined") {
        init();
      }
    },
    [user.selectedToken],
    () => {
      listener.unsubscribe();
    }
  );

  if (!user.selectedToken || tokens.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div id="app">
        <Header
          contracts={contracts}
          tokens={tokens}
          tradeableTokens={tradeableTokens}
          user={user}
          selectToken={selectToken}
        />
        <Routes>
          <Route
            exact
            path="/"
            element={
              <Home
                user={user}
                tradeableTokens={tradeableTokens}
                createMarketOrder={createMarketOrder}
                createLimitOrder={createLimitOrder}
                trades={trades}
                orders={orders}
                selectToken={selectToken}
                buyOrders={orders.buy.filter(
                  (order) =>
                    order.trader.toLowerCase() === accounts[0].toLowerCase()
                )}
                sellOrders={orders.sell.filter(
                  (order) =>
                    order.trader.toLowerCase() === accounts[0].toLowerCase()
                )}
              />
            }
          />
          <Route
            path="/wallet"
            element={
              <PageWallet
                tradeableTokens={tradeableTokens}
                web3={web3}
                user={user}
                deposit={deposit}
                withdraw={withdraw}
              />
            }
          />
        </Routes>

        <Footer contracts={contracts} />
      </div>
    </>
  );
}

export default App;
