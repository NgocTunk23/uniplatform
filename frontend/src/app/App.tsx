import { RouterProvider } from "react-router"
import { router } from "./routes";

function App() {
  // Trả về bộ định tuyến, nó sẽ tự động đọc file routes.tsx 
  // để quyết định xem trang nào sẽ hiện Component nào của Figma
  return (
    <RouterProvider router={router} />
  )
}

export default App;