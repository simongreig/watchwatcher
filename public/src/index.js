//import React from 'react';
//import ReactDOM from 'react-dom';

class Greeting extends React.Component {
    render() {
        return (<p>Hello world!</p>);
    }
}
ReactDOM.render(
    <Greeting />,
    document.getElementById('root')
);
