// Simple MicroPython native module for testing
// This module provides a simple add() function

#include "py/dynruntime.h"

// A simple function that adds two integers
STATIC mp_obj_t add(mp_obj_t a_obj, mp_obj_t b_obj) {
    mp_int_t a = mp_obj_get_int(a_obj);
    mp_int_t b = mp_obj_get_int(b_obj);
    return mp_obj_new_int(a + b);
}
STATIC MP_DEFINE_CONST_FUN_OBJ_2(add_obj, add);

// Module entry point
mp_obj_t mpy_init(mp_obj_fun_bc_t *self, size_t n_args, size_t n_kw, mp_obj_t *args) {
    MP_DYNRUNTIME_INIT_ENTRY

    mp_store_global(MP_QSTR_add, MP_OBJ_FROM_PTR(&add_obj));

    MP_DYNRUNTIME_INIT_EXIT
}
