import { render } from 'preact';
import { App } from './App';
import './styles/theme.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/components.css';
import './styles/views.css';

render(<App />, document.getElementById('app')!);
