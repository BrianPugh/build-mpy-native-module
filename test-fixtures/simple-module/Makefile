# Makefile for simple test native module

# Module name
MOD = simple

# Source files
SRC = simple.c

# Architecture (overridden by action)
ARCH = x64

# MicroPython directory (set by action via environment variable)
MPY_DIR ?= $(error MPY_DIR is not set)

# Include the MicroPython native module build rules
include $(MPY_DIR)/py/dynruntime.mk
