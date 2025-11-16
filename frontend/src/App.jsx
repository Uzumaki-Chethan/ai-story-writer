import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import HomePage from './HomePage'
import StoryWriter from './StoryWriter'

function HomePageWithNav() {
  const navigate = useNavigate()
  return <HomePage onStartWriting={() => navigate('/write')} />
}

function StoryWriterWithNav() {
  const navigate = useNavigate()
  return <StoryWriter onBackToHome={() => navigate('/')} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePageWithNav />} />
        <Route path="/write" element={<StoryWriterWithNav />} />
      </Routes>
    </BrowserRouter>
  )
}
