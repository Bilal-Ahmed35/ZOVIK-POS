const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

async function runMenuImageManagementTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING MENU MANAGEMENT & IMAGE UPLOAD/REPLACE/REMOVE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    // ------------------------------------------------------------------------
    // SETUP: Admin & Vendor Login
    // ------------------------------------------------------------------------
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'password123',
    });
    const adminToken = adminLogin.data.accessToken;

    const vendorLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'vendor@pos.com',
      password: 'password123',
    });
    const vendorToken = vendorLogin.data.accessToken;

    // Sample 1px PNG transparent base64 string
    const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // ------------------------------------------------------------------------
    // TEST 1: POST /api/menu/upload-image (Valid Upload)
    // ------------------------------------------------------------------------
    console.log('📌 TEST 1: POST /api/menu/upload-image (Upload New Dish Image)...');
    const uploadRes = await axios.post(
      `${BASE_URL}/menu/upload-image`,
      { imageBase64: samplePngBase64 },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert(uploadRes.status === 200, 'POST /api/menu/upload-image returns 200 OK');
    assert(
      uploadRes.data.imageUrl && uploadRes.data.imageUrl.startsWith('/uploads/menu_'),
      `Valid image URL path generated: ${uploadRes.data.imageUrl}`
    );
    const uploadedImageUrl = uploadRes.data.imageUrl;

    // ------------------------------------------------------------------------
    // TEST 2: Validation — Invalid File Format Rejection
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 2: Validation — Invalid File Format Rejection...');
    try {
      await axios.post(
        `${BASE_URL}/menu/upload-image`,
        { imageBase64: 'data:text/plain;base64,SGVsbG8gV29ybGQ=' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(false, 'Invalid file format rejected');
    } catch (err) {
      assert(err.response?.status === 400, 'Server rejected non-image base64 with 400 Bad Request');
    }

    // ------------------------------------------------------------------------
    // TEST 3: Admin Add New Menu Item with Image URL
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 3: Admin POST /api/menu (Create Menu Item with Image URL)...');
    const createRes = await axios.post(
      `${BASE_URL}/menu`,
      {
        name: 'Special Test Burger',
        price: 350,
        category: 'Fast Food',
        prepTime: 12,
        stock: 45,
        description: 'Juicy special burger for automated testing.',
        imageUrl: uploadedImageUrl,
        isActive: true,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert(createRes.status === 201, 'POST /api/menu returns 201 Created');
    const createdItem = createRes.data.item;
    assert(createdItem.imageUrl === uploadedImageUrl, 'MenuItem.imageUrl stored in database');

    // ------------------------------------------------------------------------
    // TEST 4: Vendor Edit Menu Item & Replace Image
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 4: Vendor PUT /api/menu/:id (Edit & Replace Image)...');
    // Upload replacement image
    const replaceRes = await axios.post(
      `${BASE_URL}/menu/upload-image`,
      { imageBase64: samplePngBase64 },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    const replacementUrl = replaceRes.data.imageUrl;

    const updateRes = await axios.put(
      `${BASE_URL}/menu/${createdItem.id}`,
      {
        name: 'Updated Special Test Burger',
        price: 380,
        imageUrl: replacementUrl,
        isActive: true,
      },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );

    assert(updateRes.status === 200, 'Vendor PUT /api/menu/:id returns 200 OK');
    assert(updateRes.data.item.name === 'Updated Special Test Burger', 'Name updated in DB');
    assert(updateRes.data.item.imageUrl === replacementUrl, 'Replacement imageUrl updated in DB');

    // ------------------------------------------------------------------------
    // TEST 5: Image Removal (Set imageUrl to null)
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 5: Remove Image (Set imageUrl to null)...');
    const removeImgRes = await axios.put(
      `${BASE_URL}/menu/${createdItem.id}`,
      { imageUrl: null },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    assert(removeImgRes.status === 200, 'PUT /api/menu/:id returns 200 OK on image removal');
    assert(removeImgRes.data.item.imageUrl === null, 'MenuItem.imageUrl set to null in database');

    // ------------------------------------------------------------------------
    // TEST 6: Vendor Delete Menu Item
    // ------------------------------------------------------------------------
    console.log('\n📌 TEST 6: Vendor DELETE /api/menu/:id (Delete Menu Item)...');
    const deleteRes = await axios.delete(`${BASE_URL}/menu/${createdItem.id}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });

    assert(deleteRes.status === 200, 'Vendor DELETE /api/menu/:id returns 200 OK');

    // Verify item is removed or deactivated
    try {
      const getRes = await axios.get(`${BASE_URL}/menu/${createdItem.id}`);
      assert(getRes.data.item?.isActive === false, 'Item verified soft-deleted (deactivated) in database');
    } catch (getErr) {
      assert(getErr.response?.status === 404, 'Item verified hard-deleted (404 Not Found) in database');
    }

    console.log('\n================================================================');
    console.log(`📊 MENU & IMAGE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Fatal error in menu image test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

runMenuImageManagementTestSuite();
