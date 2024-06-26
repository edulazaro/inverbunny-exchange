import { useState, useEffect } from "react";
import { getWeb3, getContracts } from './utils.js';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

function LoadingContainer() {
  const [web3, setWeb3] = useState(undefined);
  const [accounts, setAccounts] = useState([]);
  const [contracts, setContracts] = useState(undefined);

  useEffect(() => {
    const init = async () => {
      const web3 = await getWeb3();
      const contracts = await getContracts(web3);
      const accounts = await web3.eth.getAccounts();
      setWeb3(web3);
      setContracts(contracts);
      setAccounts(accounts);
    }
    init();
  // eslint-disable-next-line
  }, []);

  const isReady = () => {
    return (
      typeof web3 !== 'undefined' 
      && typeof contracts !== 'undefined'
      && accounts.length > 0
    );
  }

  if (!isReady()) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <App
        web3={web3}
        accounts={accounts}
        contracts={contracts}
      />
    </BrowserRouter>
  );
}

export default LoadingContainer;