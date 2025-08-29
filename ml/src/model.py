# ml/src/model.py
# Defines the architecture for our RNN model.

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

def build_model(input_shape):
    """
    Builds and compiles the RNN model.

    Args:
        input_shape (tuple): The shape of the input data (timesteps, features).

    Returns:
        A compiled Keras model.
    """
    print(f"model.build_model: Building model with input shape: {input_shape}")
    
    model = Sequential([
        # First LSTM layer with dropout for regularization
        LSTM(units=50, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        
        # Second LSTM layer
        LSTM(units=50, return_sequences=False),
        Dropout(0.2),
        
        # A dense hidden layer
        Dense(units=25),
        
        # The output layer: 1 neuron for the single predicted value
        Dense(units=1) 
    ])
    
    # Compile the model
    # We use 'mean_squared_error' as the loss function because we are predicting a continuous value.
    model.compile(optimizer='adam', loss='mean_squared_error')
    
    print("model.build_model: Model built and compiled successfully.")
    model.summary()
    
    return model

# File: ml/src/model.py - Character count: 1253