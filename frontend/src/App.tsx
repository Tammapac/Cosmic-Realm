import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status));
  }, []);

  return (
    <div>
      <h1>Cosmic Realm Odyssey</h1>
      <p>Server status: {status}</p>
    </div>
  );
}

export default App;
