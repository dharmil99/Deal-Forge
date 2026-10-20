import { RouterProvider } from 'react-router-dom';
import { ShellProvider } from '@/context/ShellContext';
import { DealProvider } from '@/context/DealContext';
import { router } from '@/routes';

export function App() {
  return (
    <ShellProvider>
      <DealProvider>
        <RouterProvider router={router} />
      </DealProvider>
    </ShellProvider>
  );
}

export default App;
