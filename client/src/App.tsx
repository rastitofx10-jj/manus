import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AgentOSLayout from "./components/AgentOSLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Missions from "./pages/Missions";
import MissionDetail from "./pages/MissionDetail";
import Agents from "./pages/Agents";
import Terminal from "./pages/Terminal";
import Files from "./pages/Files";
import BrowserTasks from "./pages/BrowserTasks";
import Memory from "./pages/Memory";
import Approvals from "./pages/Approvals";
import Deployments from "./pages/Deployments";
import GitHub from "./pages/GitHub";
import SettingsPage from "./pages/Settings";

function Router() {
  return (
    <AgentOSLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/missions" component={Missions} />
        <Route path="/missions/:id" component={MissionDetail} />
        <Route path="/agents" component={Agents} />
        <Route path="/terminal" component={Terminal} />
        <Route path="/files" component={Files} />
        <Route path="/browser" component={BrowserTasks} />
        <Route path="/memory" component={Memory} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/deployments" component={Deployments} />
        <Route path="/github" component={GitHub} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AgentOSLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="bottom-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
