import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
    color: #690707;
`;

const SingleError = styled.div`
    background: #ddaeae;
    padding: 15px;
    margin-bottom: 10px;

    &:last-child {
        margin-bottom: 0;
    }
`;

function Error(props) {
    if (props.error) {
        return <ErrorContainer>
            {props.error.split('\n').map((err) => 
                <SingleError>{ err }</SingleError>
            )}
        </ErrorContainer>;
    } else {
        return '';
    }
    
}

export default Error;