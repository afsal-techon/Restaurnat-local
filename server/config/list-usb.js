import usb from 'usb';

const devices = usb.getDeviceList();
devices.forEach((device, index) => {
  const { idVendor, idProduct } = device.deviceDescriptor;
  console.log(`Device ${index + 1}: VendorID=${idVendor.toString(16)}, ProductID=${idProduct.toString(16)}`);
});